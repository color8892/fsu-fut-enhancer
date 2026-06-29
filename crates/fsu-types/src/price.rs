use serde::{Deserialize, Serialize};

/// Price source category matching FSU `info.roster.data[*].y`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PriceType {
    Market = 0,
    Sbc = 1,
    Objective = 2,
    SeasonPass = 3,
}

impl Default for PriceType {
    fn default() -> Self {
        Self::Market
    }
}

impl From<i32> for PriceType {
    fn from(value: i32) -> Self {
        match value {
            1 => Self::Sbc,
            2 => Self::Objective,
            3 => Self::SeasonPass,
            _ => Self::Market,
        }
    }
}

impl From<PriceType> for i32 {
    fn from(value: PriceType) -> Self {
        value as Self
    }
}

/// Cached price record stored in roster / returned from APIs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PriceEntry {
    pub amount: i32,
    pub price_type: PriceType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fetched_at_ms: Option<i64>,
}

impl PriceEntry {
    pub fn new(amount: i32, price_type: PriceType) -> Self {
        Self {
            amount,
            price_type,
            fetched_at_ms: None,
        }
    }

    pub fn with_timestamp(mut self, fetched_at_ms: i64) -> Self {
        self.fetched_at_ms = Some(fetched_at_ms);
        self
    }
}

/// UI-friendly cache price view (`getCachePrice` type=1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CachedPriceDisplay {
    pub num: i32,
    pub text: String,
    pub price_type: PriceType,
}