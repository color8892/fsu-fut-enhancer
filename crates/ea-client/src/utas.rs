use crate::error::EaClientError;
use crate::player::{parse_club_player, ClubPlayer};
use crate::session::EaSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const UTAS_BASE_URL: &str = "https://utas.mob.v5.prd.futc-ext.gcp.ea.com";
pub const UTAS_GAME_SLUG: &str = "fc26";
pub const CLUB_PAGE_SIZE: i32 = 91;

#[cfg(feature = "async")]
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClubPlayersResult {
    pub player_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClubRatingInventory {
    pub total_players: usize,
    pub rating_counts: HashMap<i32, i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClubPlayersList {
    pub total_players: usize,
    pub players: Vec<ClubPlayer>,
}

#[derive(Debug, Deserialize)]
struct ClubPlayersPage {
    #[serde(default, rename = "itemData")]
    item_data: Vec<serde_json::Value>,
}

/// Read-only UTAS client.
pub struct UtasClient {
    base_url: String,
    game_slug: String,
    #[cfg(feature = "async")]
    http: Client,
}

impl Default for UtasClient {
    fn default() -> Self {
        Self::new()
    }
}

impl UtasClient {
    pub fn new() -> Self {
        Self {
            base_url: UTAS_BASE_URL.to_string(),
            game_slug: UTAS_GAME_SLUG.to_string(),
            #[cfg(feature = "async")]
            http: Client::new(),
        }
    }

    pub fn with_base_url(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            game_slug: UTAS_GAME_SLUG.to_string(),
            #[cfg(feature = "async")]
            http: Client::new(),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn game_slug(&self) -> &str {
        &self.game_slug
    }

    pub fn club_players_url(&self, start: i32, count: i32) -> String {
        format!(
            "{}/ut/game/{}/club?sort=desc&type=player&start={}&count={}",
            self.base_url, self.game_slug, start, count
        )
    }

    /// Read the first page of club players (read-only).
    #[cfg(feature = "async")]
    pub async fn fetch_club_players(&self, session: &EaSession) -> Result<ClubPlayersResult, EaClientError> {
        let page = self.fetch_club_page(session, 0, CLUB_PAGE_SIZE).await?;
        Ok(ClubPlayersResult {
            player_count: page.item_data.len(),
        })
    }

    /// Paginate club players and aggregate rating counts.
    #[cfg(feature = "async")]
    pub async fn fetch_club_inventory(&self, session: &EaSession) -> Result<ClubRatingInventory, EaClientError> {
        if session.access_token.is_empty() {
            return Err(EaClientError::MissingSession);
        }

        let mut rating_counts: HashMap<i32, i32> = HashMap::new();
        let mut total_players = 0usize;
        let mut start = 0i32;

        loop {
            let page = self.fetch_club_page(session, start, CLUB_PAGE_SIZE).await?;
            let page_len = page.item_data.len();
            if page_len == 0 {
                break;
            }

            for item in &page.item_data {
                let Some(rating) = item.get("rating").and_then(|value| value.as_i64()) else {
                    continue;
                };
                let rating = rating as i32;
                *rating_counts.entry(rating).or_insert(0) += 1;
                total_players += 1;
            }

            if page_len < CLUB_PAGE_SIZE as usize {
                break;
            }

            start += CLUB_PAGE_SIZE;
        }

        Ok(ClubRatingInventory {
            total_players,
            rating_counts,
        })
    }

    /// Paginate club players and return parsed identity fields.
    #[cfg(feature = "async")]
    pub async fn fetch_club_players_list(
        &self,
        session: &EaSession,
    ) -> Result<ClubPlayersList, EaClientError> {
        if session.access_token.is_empty() {
            return Err(EaClientError::MissingSession);
        }

        let mut players = Vec::new();
        let mut start = 0i32;

        loop {
            let page = self.fetch_club_page(session, start, CLUB_PAGE_SIZE).await?;
            let page_len = page.item_data.len();
            if page_len == 0 {
                break;
            }

            for item in &page.item_data {
                if let Some(player) = parse_club_player(item) {
                    players.push(player);
                }
            }

            if page_len < CLUB_PAGE_SIZE as usize {
                break;
            }

            start += CLUB_PAGE_SIZE;
        }

        Ok(ClubPlayersList {
            total_players: players.len(),
            players,
        })
    }

    #[cfg(feature = "async")]
    async fn fetch_club_page(
        &self,
        session: &EaSession,
        start: i32,
        count: i32,
    ) -> Result<ClubPlayersPage, EaClientError> {
        if session.access_token.is_empty() {
            return Err(EaClientError::MissingSession);
        }

        let url = self.club_players_url(start, count);
        let mut request = self
            .http
            .get(&url)
            .header("X-UT-SID", &session.access_token)
            .header("Content-Type", "application/json");

        if let Some(persona_id) = &session.persona_id {
            request = request.header("Easw-Session-Data-Id", persona_id);
        }

        if let Some(nucleus_id) = &session.nucleus_id {
            request = request.header("Easw-Session-Data-Nucleus-Id", nucleus_id);
        }

        let response = request
            .send()
            .await
            .map_err(|error| EaClientError::Http(error.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| EaClientError::Http(error.to_string()))?;

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(EaClientError::Http(
                "unauthorized — paste a valid X-UT-SID from the FUT web app".into(),
            ));
        }

        if !status.is_success() {
            return Err(EaClientError::Http(format!("HTTP {status}: {body}")));
        }

        serde_json::from_str(&body).map_err(|error| EaClientError::Parse(error.to_string()))
    }

    #[cfg(not(feature = "async"))]
    pub fn fetch_club_players(&self, _session: &EaSession) -> Result<ClubPlayersResult, EaClientError> {
        Err(EaClientError::NotImplemented("fetch_club_players requires async feature"))
    }

    #[cfg(not(feature = "async"))]
    pub fn fetch_club_inventory(&self, _session: &EaSession) -> Result<ClubRatingInventory, EaClientError> {
        Err(EaClientError::NotImplemented("fetch_club_inventory requires async feature"))
    }

    #[cfg(not(feature = "async"))]
    pub fn fetch_club_players_list(&self, _session: &EaSession) -> Result<ClubPlayersList, EaClientError> {
        Err(EaClientError::NotImplemented(
            "fetch_club_players_list requires async feature",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::GamePlatform;

    #[test]
    fn session_builder_sets_platform() {
        let session = EaSession::new("token", GamePlatform::Pc).with_persona("123");
        assert_eq!(session.game_platform, GamePlatform::Pc);
        assert_eq!(session.persona_id.as_deref(), Some("123"));
    }

    #[test]
    fn club_players_url_includes_game_slug_and_pagination() {
        let client = UtasClient::new();
        let url = client.club_players_url(0, CLUB_PAGE_SIZE);
        assert!(url.contains("/ut/game/fc26/club"));
        assert!(url.contains("start=0"));
        assert!(url.contains("count=91"));
    }

    #[tokio::test]
    #[cfg(feature = "async")]
    async fn fetch_club_players_requires_session() {
        let client = UtasClient::new();
        let session = EaSession::new("", GamePlatform::Ps);
        let error = client.fetch_club_players(&session).await.unwrap_err();
        assert!(matches!(error, EaClientError::MissingSession));
    }

    #[tokio::test]
    #[cfg(feature = "async")]
    async fn fetch_club_inventory_requires_session() {
        let client = UtasClient::new();
        let session = EaSession::new("", GamePlatform::Ps);
        let error = client.fetch_club_inventory(&session).await.unwrap_err();
        assert!(matches!(error, EaClientError::MissingSession));
    }
}