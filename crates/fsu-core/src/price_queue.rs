//! Deduplicates in-flight price API requests by batch key.
//! Ported from `extension/src/fsu/core/PriceRequestQueue.js`.

use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::Arc;
use tokio::sync::{Mutex, OnceCell};

type PendingCell<T> = Arc<OnceCell<T>>;

pub struct PriceRequestQueue<T> {
    in_flight: Arc<Mutex<HashMap<String, PendingCell<T>>>>,
}

impl<T: Clone + Send + Sync + 'static> Default for PriceRequestQueue<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Clone + Send + Sync + 'static> PriceRequestQueue<T> {
    pub fn new() -> Self {
        Self {
            in_flight: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn run<K, F, Fut>(&self, key: K, task: F) -> T
    where
        K: Into<String> + Clone + Hash + Eq,
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = T> + Send + 'static,
    {
        let key = key.into();
        let cell = {
            let mut guard = self.in_flight.lock().await;
            guard
                .entry(key.clone())
                .or_insert_with(|| Arc::new(OnceCell::new()))
                .clone()
        };

        let in_flight = Arc::clone(&self.in_flight);
        let cleanup_key = key.clone();

        cell
            .get_or_init(|| async move {
                let result = task().await;
                in_flight.lock().await.remove(&cleanup_key);
                result
            })
            .await
            .clone()
    }

    pub async fn clear(&self) {
        self.in_flight.lock().await.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[tokio::test]
    async fn deduplicates_in_flight_requests() {
        let queue = Arc::new(PriceRequestQueue::<i32>::new());
        let calls = Arc::new(AtomicUsize::new(0));
        let gate = Arc::new(tokio::sync::Notify::new());

        let queue_a = Arc::clone(&queue);
        let calls_a = Arc::clone(&calls);
        let gate_a = Arc::clone(&gate);
        let first = tokio::spawn(async move {
            queue_a
                .run("k", move || {
                    let gate = Arc::clone(&gate_a);
                    async move {
                        calls_a.fetch_add(1, Ordering::SeqCst);
                        gate.notified().await;
                        42
                    }
                })
                .await
        });

        tokio::task::yield_now().await;

        let queue_b = Arc::clone(&queue);
        let calls_b = Arc::clone(&calls);
        let second = tokio::spawn(async move {
            queue_b
                .run("k", move || async move {
                    calls_b.fetch_add(1, Ordering::SeqCst);
                    99
                })
                .await
        });

        tokio::task::yield_now().await;
        gate.notify_waiters();

        let (a, b) = tokio::join!(first, second);
        assert_eq!(a.unwrap(), 42);
        assert_eq!(b.unwrap(), 42);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}