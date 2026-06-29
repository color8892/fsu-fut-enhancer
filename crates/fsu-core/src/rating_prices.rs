//! Rating-tier low prices from FSU `api.fut.to` (same source as the extension).

use serde_json::Value;
use std::collections::HashMap;

pub const LOWPRICE_URL: &str = "https://api.fut.to/26/lowprice.json";

/// Parse platform-specific rating prices from the lowprice.json payload.
pub fn parse_lowprice_platform(data: &Value, platform: &str) -> HashMap<i32, i32> {
    let platform_key = if platform == "pc" { "pc" } else { "ps" };
    let Some(entries) = data.get(platform_key).and_then(Value::as_object) else {
        return HashMap::new();
    };

    let mut prices = HashMap::new();
    for (key, value) in entries {
        let Ok(rating) = key.parse::<i32>() else {
            continue;
        };
        if let Some(price) = value.as_i64() {
            prices.insert(rating, price as i32);
        }
    }
    prices
}

/// Fetch rating low prices for PC or console markets.
#[cfg(feature = "async")]
use crate::price_service::{HttpGet, PriceFetchError};

#[cfg(feature = "async")]
pub async fn fetch_rating_lowprices<H: HttpGet>(
    http: H,
    platform: &str,
) -> Result<HashMap<i32, i32>, PriceFetchError> {
    let body = http.get(LOWPRICE_URL).await?;
    let data: Value = serde_json::from_str(&body).map_err(|error| PriceFetchError::Parse(error.to_string()))?;
    Ok(parse_lowprice_platform(&data, platform))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_lowprice_platform_maps_numeric_ratings() {
        let data = json!({
            "pc": { "84": 1200, "85": 1500, "low": 45, "high": 99 },
            "ps": { "84": 1100 }
        });

        let pc = parse_lowprice_platform(&data, "pc");
        assert_eq!(pc.get(&84), Some(&1200));
        assert_eq!(pc.get(&85), Some(&1500));
        assert!(!pc.contains_key(&45));

        let ps = parse_lowprice_platform(&data, "ps");
        assert_eq!(ps.get(&84), Some(&1100));
    }
}