//! Shared domain types for FSU (extension, WASM, and standalone app).

mod price;

pub use price::{CachedPriceDisplay, PriceEntry, PriceType};

use serde::{Deserialize, Serialize};

/// Sentinel for unset nation / league / club on a squad slot.
pub const UNSET_ID: i32 = -1;

/// Minimal player identity used for SBC chemistry calculations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PlayerIdentity {
    pub nation_id: i32,
    pub league_id: i32,
    pub team_id: i32,
}

impl PlayerIdentity {
    pub fn new(nation_id: i32, league_id: i32, team_id: i32) -> Self {
        Self {
            nation_id,
            league_id,
            team_id,
        }
    }

    pub fn empty() -> Self {
        Self::default()
    }
}

/// Club metadata for chemistry candidate generation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TeamInfo {
    pub league_id: i32,
}