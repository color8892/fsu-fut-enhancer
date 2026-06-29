//! Price batching, parsing, and display helpers.
//! Ported from `extension/src/fsu/domain/PriceService.js`.

use fsu_types::{CachedPriceDisplay, PriceEntry, PriceType};
use serde::Deserialize;
use std::collections::HashMap;

pub const PRICE_BATCH_SIZE: usize = 23;

/// EA API platform selector from `info.apiPlatform`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiPlatform {
    FutGg = 2,
    FutNext = 3,
}

/// Split definition IDs into FUT.GG batch chunks (extension uses 23).
pub fn batch_definition_ids(definition_ids: &[i32]) -> Vec<Vec<i32>> {
    if definition_ids.is_empty() {
        return Vec::new();
    }

    definition_ids
        .chunks(PRICE_BATCH_SIZE)
        .map(|chunk| chunk.to_vec())
        .collect()
}

/// Queue dedupe key used by `PriceService.getPriceForUrl`.
pub fn build_price_queue_key(definition_ids: &[i32]) -> String {
    let mut sorted: Vec<i32> = definition_ids.to_vec();
    sorted.sort_unstable();
    format!("url:{}", sorted.iter().map(i32::to_string).collect::<Vec<_>>().join(","))
}

pub fn build_futgg_url(definition_ids: &[i32], platform: &str, proxy_prefix: Option<&str>) -> String {
    let params = definition_ids
        .iter()
        .map(|id| id.to_string())
        .collect::<Vec<_>>()
        .join("%2C");

    let base = proxy_prefix
        .map(|p| format!("{p}?futggapi="))
        .unwrap_or_else(|| "https://www.fut.gg/api/fut/".to_string());

    let platform_query = if platform == "pc" {
        format!("&platform={platform}")
    } else {
        String::new()
    };

    format!("{base}player-prices/26/?ids={params}{platform_query}")
}

pub fn build_futnext_url(definition_ids: &[i32], platform: &str) -> String {
    let params = definition_ids
        .iter()
        .map(|id| id.to_string())
        .collect::<Vec<_>>()
        .join("_");

    format!(
        "https://enhancer-api.futnext.com/players/prices?ids={params}&platform={platform}"
    )
}

#[derive(Debug, Deserialize)]
struct FutGgResponse {
    data: Vec<FutGgPlayerPrice>,
}

#[derive(Debug, Deserialize)]
struct FutGgPlayerPrice {
    #[serde(rename = "eaId")]
    ea_id: i32,
    price: Option<i32>,
    #[serde(rename = "isExtinct")]
    is_extinct: Option<bool>,
    #[serde(rename = "isSbc")]
    is_sbc: Option<bool>,
    #[serde(rename = "isObjective")]
    is_objective: Option<bool>,
    #[serde(rename = "premiumSeasonPassLevel")]
    premium_season_pass_level: Option<i32>,
    #[serde(rename = "standardSeasonPassLevel")]
    standard_season_pass_level: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct FutNextPriceRow {
    #[serde(rename = "definitionId")]
    definition_id: i32,
    prices: Vec<i32>,
}

fn futgg_row_to_entry(item: &FutGgPlayerPrice, now_ms: i64) -> Option<PriceEntry> {
    let has_signal = item.price.is_some()
        || item.is_extinct.unwrap_or(false)
        || item.is_sbc.unwrap_or(false)
        || item.is_objective.unwrap_or(false)
        || item.premium_season_pass_level.is_some()
        || item.standard_season_pass_level.is_some();

    if !has_signal {
        return None;
    }

    let mut price_type = PriceType::Market;
    if item.is_sbc.unwrap_or(false) {
        price_type = PriceType::Sbc;
    } else if item.is_objective.unwrap_or(false) {
        price_type = if item.premium_season_pass_level.is_some()
            || item.standard_season_pass_level.is_some()
        {
            PriceType::SeasonPass
        } else {
            PriceType::Objective
        };
    }

    let amount = match item.price {
        Some(value) if value != -1 => value,
        _ => 0,
    };

    Some(PriceEntry::new(amount, price_type).with_timestamp(now_ms))
}

/// Parse a FUT.GG `player-prices` JSON payload.
pub fn parse_futgg_prices(json: &str, now_ms: i64) -> Result<HashMap<i32, PriceEntry>, serde_json::Error> {
    let response: FutGgResponse = serde_json::from_str(json)?;
    let mut out = HashMap::new();

    for item in response.data {
        if let Some(entry) = futgg_row_to_entry(&item, now_ms) {
            out.insert(item.ea_id, entry);
        }
    }

    Ok(out)
}

/// Parse a FUTNEXT enhancer-api prices JSON payload.
pub fn parse_futnext_prices(json: &str, now_ms: i64) -> Result<HashMap<i32, PriceEntry>, serde_json::Error> {
    let rows: Vec<FutNextPriceRow> = serde_json::from_str(json)?;
    let mut out = HashMap::new();

    for row in rows {
        if let Some(&amount) = row.prices.first() {
            out.insert(
                row.definition_id,
                PriceEntry::new(amount, PriceType::Market).with_timestamp(now_ms),
            );
        }
    }

    Ok(out)
}

/// `getCachePrice(definitionId, type=1)` display mapping.
pub fn format_cache_price(entry: &PriceEntry) -> CachedPriceDisplay {
    let mut text = entry.amount.to_string();
    if entry.price_type != PriceType::Market && entry.amount == 0 {
        text = "Reward".to_string();
    }

    CachedPriceDisplay {
        num: entry.amount,
        text,
        price_type: entry.price_type,
    }
}

/// Auction price delta HTML snippet (`priceLastDiff`).
pub fn price_last_diff(purchase_price: i64, last_price: i64) -> String {
    let mut percent = ((purchase_price as f64 * 0.95) / last_price as f64 - 1.0) * 100.0;
    if !percent.is_finite() {
        percent = 0.0;
    }

    let rounded = percent.round() as i64;
    let value = format!("{rounded:+}%").replace("+-", "-");
    if value.contains('+') {
        format!(r#"<span class="plus">{value}</span>"#)
    } else {
        format!(r#"<span class="minus">{value}</span>"#)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_definition_ids_chunks_by_23() {
        let ids: Vec<i32> = (1..=30).collect();
        let batches = batch_definition_ids(&ids);
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].len(), 23);
        assert_eq!(batches[1].len(), 7);
    }

    #[test]
    fn build_price_queue_key_sorts_ids() {
        let key = build_price_queue_key(&[3, 1, 2]);
        assert_eq!(key, "url:1,2,3");
    }

    #[test]
    fn price_last_diff_matches_js_fixture() {
        let html = price_last_diff(100, 100);
        assert!(html.contains("minus"));
        assert!(html.contains("-5%"));
    }

    #[test]
    fn parse_futgg_prices_maps_rows() {
        let json = r#"{
            "data": [
                {"eaId": 10, "price": 1500, "isSbc": false, "isObjective": false},
                {"eaId": 11, "price": null, "isSbc": true, "isObjective": false}
            ]
        }"#;

        let parsed = parse_futgg_prices(json, 1_700_000_000_000).unwrap();
        assert_eq!(parsed.get(&10).unwrap().amount, 1500);
        assert_eq!(parsed.get(&11).unwrap().price_type, PriceType::Sbc);
    }

    #[test]
    fn format_cache_price_reward_text() {
        let display = format_cache_price(&PriceEntry::new(0, PriceType::Sbc));
        assert_eq!(display.text, "Reward");
    }
}