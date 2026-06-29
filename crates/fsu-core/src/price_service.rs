//! Async price fetching with in-flight deduplication.

use crate::price::{
    batch_definition_ids, build_futgg_url, build_futnext_url, build_price_queue_key, parse_futgg_prices,
    parse_futnext_prices, ApiPlatform,
};
use crate::price_queue::PriceRequestQueue;
use fsu_types::PriceEntry;
use std::collections::HashMap;
use std::future::Future;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, thiserror::Error)]
pub enum PriceFetchError {
    #[error("HTTP request failed: {0}")]
    Http(String),
    #[error("JSON parse failed: {0}")]
    Parse(String),
    #[error("Unsupported API platform")]
    UnsupportedPlatform,
}

pub trait HttpGet: Send + Sync {
    fn get(&self, url: &str) -> impl Future<Output = Result<String, PriceFetchError>> + Send;
}

pub struct PriceService {
    queue: PriceRequestQueue<Result<HashMap<i32, PriceEntry>, PriceFetchError>>,
}

impl Default for PriceService {
    fn default() -> Self {
        Self::new()
    }
}

impl PriceService {
    pub fn new() -> Self {
        Self {
            queue: PriceRequestQueue::new(),
        }
    }

    pub async fn get_price_for_url<H: HttpGet + Clone + Send + Sync + 'static>(
        &self,
        http: H,
        platform: ApiPlatform,
        game_platform: &str,
        proxy_prefix: Option<&str>,
        definition_ids: &[i32],
    ) -> Result<HashMap<i32, PriceEntry>, PriceFetchError> {
        let key = build_price_queue_key(definition_ids);
        let ids = definition_ids.to_vec();
        let game_platform = game_platform.to_string();
        let proxy_prefix = proxy_prefix.map(str::to_string);

        self.queue
            .run(key, move || {
                let http = http.clone();
                let game_platform = game_platform.clone();
                let proxy_prefix = proxy_prefix.clone();
                async move {
                    Self::fetch_all_batches(
                        &http,
                        platform,
                        &game_platform,
                        proxy_prefix.as_deref(),
                        &ids,
                    )
                    .await
                }
            })
            .await
    }

    async fn fetch_all_batches<H: HttpGet>(
        http: &H,
        api_platform: ApiPlatform,
        game_platform: &str,
        proxy_prefix: Option<&str>,
        definition_ids: &[i32],
    ) -> Result<HashMap<i32, PriceEntry>, PriceFetchError> {
        let mut merged = HashMap::new();

        for batch in batch_definition_ids(definition_ids) {
            let chunk = Self::fetch_batch(http, api_platform, game_platform, proxy_prefix, &batch).await?;
            merged.extend(chunk);
        }

        Ok(merged)
    }

    async fn fetch_batch<H: HttpGet>(
        http: &H,
        api_platform: ApiPlatform,
        game_platform: &str,
        proxy_prefix: Option<&str>,
        definition_ids: &[i32],
    ) -> Result<HashMap<i32, PriceEntry>, PriceFetchError> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let url = match api_platform {
            ApiPlatform::FutGg => build_futgg_url(definition_ids, game_platform, proxy_prefix),
            ApiPlatform::FutNext => build_futnext_url(definition_ids, game_platform),
        };

        let body = http.get(&url).await?;

        match api_platform {
            ApiPlatform::FutGg => parse_futgg_prices(&body, now_ms)
                .map_err(|error| PriceFetchError::Parse(error.to_string())),
            ApiPlatform::FutNext => parse_futnext_prices(&body, now_ms)
                .map_err(|error| PriceFetchError::Parse(error.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct MockHttp {
        body: String,
    }

    impl HttpGet for MockHttp {
        async fn get(&self, _url: &str) -> Result<String, PriceFetchError> {
            Ok(self.body.clone())
        }
    }

    #[tokio::test]
    async fn get_price_for_url_batches_and_merges() {
        let service = PriceService::new();
        let json = r#"{"data":[{"eaId":1,"price":100},{"eaId":2,"price":200}]}"#;
        let http = MockHttp {
            body: json.to_string(),
        };

        let result = service
            .get_price_for_url(http, ApiPlatform::FutGg, "pc", None, &[1, 2])
            .await
            .unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result.get(&1).unwrap().amount, 100);
    }
}