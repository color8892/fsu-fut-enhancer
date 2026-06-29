//! FSU domain logic — portable across Tauri app, WASM, and tests.

pub mod price;
#[cfg(feature = "async")]
pub mod price_queue;
#[cfg(feature = "async")]
pub mod price_service;
pub mod rating_prices;
pub mod sbc_chemistry;
pub mod sbc_rating;

pub use price::{
    batch_definition_ids, build_futgg_url, build_futnext_url, build_price_queue_key, format_cache_price,
    parse_futgg_prices, parse_futnext_prices, price_last_diff, ApiPlatform, PRICE_BATCH_SIZE,
};
#[cfg(feature = "async")]
pub use price_queue::PriceRequestQueue;
#[cfg(feature = "async")]
pub use price_service::{HttpGet, PriceFetchError, PriceService};
pub use rating_prices::{parse_lowprice_platform, LOWPRICE_URL};
#[cfg(feature = "async")]
pub use rating_prices::fetch_rating_lowprices;
pub use sbc_chemistry::{
    ChemistryMeta, ChemistryResult, IdentityTeamLookup, MapTeamLookup, SbcChemistryService,
    TeamLookup,
};
pub use sbc_rating::{
    multicombinations, need_ratings_count, team_rating_count, RatingNeedOptions, RatingNeedResult,
};