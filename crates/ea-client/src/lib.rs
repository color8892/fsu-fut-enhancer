//! EA UTAS client skeleton for future standalone integrations.
//!
//! This crate intentionally starts read-only and session-oriented. Full login
//! flows are high-risk and will be added incrementally.

pub mod error;
pub mod player;
pub mod session;
pub mod utas;

pub use error::EaClientError;
pub use player::{
    build_club_league_map, build_club_snapshot, parse_club_player, ClubPlayer, ClubSnapshot,
};
pub use session::{EaSession, GamePlatform};
pub use utas::{
    ClubPlayersList, ClubPlayersResult, ClubRatingInventory, UtasClient, CLUB_PAGE_SIZE,
    UTAS_BASE_URL, UTAS_GAME_SLUG,
};