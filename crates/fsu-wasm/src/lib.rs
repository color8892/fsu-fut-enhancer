//! WASM exports for the Chrome extension page runtime.

use fsu_core::{
    need_ratings_count, price_last_diff, team_rating_count, ChemistryMeta, IdentityTeamLookup,
    MapTeamLookup, RatingNeedOptions, SbcChemistryService,
};
use fsu_types::{PlayerIdentity, UNSET_ID};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[derive(Debug, Deserialize)]
struct PlayerInput {
    nation_id: i32,
    league_id: i32,
    team_id: i32,
}

#[derive(Debug, Deserialize)]
struct ChemistryRequest {
    players: Vec<Option<PlayerInput>>,
    skip_index: Option<usize>,
    candidate: Option<PlayerInput>,
    include_meta: bool,
}

#[derive(Debug, Serialize)]
struct ChemistryOutput {
    total_chemistry: i32,
    player_chemistry: Option<i32>,
    nations: Option<Vec<i32>>,
    leagues: Option<Vec<i32>>,
    clubs: Option<Vec<i32>>,
}

#[wasm_bindgen(js_name = fsuTeamRatingCount)]
pub fn wasm_team_rating_count(ratings: &[i32]) -> i32 {
    team_rating_count(ratings)
}

#[wasm_bindgen(js_name = fsuPriceLastDiff)]
pub fn wasm_price_last_diff(purchase_price: i32, last_price: i32) -> String {
    price_last_diff(purchase_price as i64, last_price as i64)
}

#[wasm_bindgen(js_name = fsuCalculateChemistry)]
pub fn wasm_calculate_chemistry(request_json: &str) -> Result<String, JsValue> {
    let request: ChemistryRequest =
        serde_json::from_str(request_json).map_err(|error| JsValue::from_str(&error.to_string()))?;

    let service = SbcChemistryService::new(IdentityTeamLookup);
    let squad: Vec<Option<PlayerIdentity>> = request
        .players
        .into_iter()
        .map(|player| {
            player.map(|entry| {
                PlayerIdentity::new(entry.nation_id, entry.league_id, entry.team_id)
            })
        })
        .collect();

    let candidate = request.candidate.map(|entry| {
        PlayerIdentity::new(entry.nation_id, entry.league_id, entry.team_id)
    });

    let result = service.calculate_chemistry(
        &squad,
        request.skip_index,
        candidate,
        request.include_meta,
    );

    let output = ChemistryOutput {
        total_chemistry: result.total_chemistry,
        player_chemistry: result.player_chemistry,
        nations: result.meta.as_ref().map(|meta| meta.nations.clone()),
        leagues: result.meta.as_ref().map(|meta| meta.leagues.clone()),
        clubs: result.meta.as_ref().map(|meta| meta.clubs.clone()),
    };

    serde_json::to_string(&output).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[derive(Debug, Deserialize)]
struct NeedRatingsRequest {
    target: i32,
    existing_ratings: Vec<i32>,
    brick_count: usize,
    available_ratings: Vec<i32>,
    available_counts: HashMap<i32, i32>,
    price_by_rating: HashMap<i32, i32>,
    squad_absent: bool,
}

#[derive(Debug, Serialize)]
struct NeedRatingsOutput {
    ratings: Vec<i32>,
    sum: i32,
    exist_value: i32,
    exist_ratings: Vec<i32>,
    lack_value: i32,
    lack_ratings: Vec<i32>,
}

#[wasm_bindgen(js_name = fsuNeedRatingsCount)]
pub fn wasm_need_ratings_count(request_json: &str) -> Result<String, JsValue> {
    let request: NeedRatingsRequest =
        serde_json::from_str(request_json).map_err(|error| JsValue::from_str(&error.to_string()))?;

    let options = RatingNeedOptions {
        target: request.target,
        existing_ratings: request.existing_ratings,
        brick_count: request.brick_count,
        available_ratings: request.available_ratings,
        available_counts: request.available_counts,
        price_by_rating: request.price_by_rating,
        squad_absent: request.squad_absent,
    };

    let results = need_ratings_count(&options)
        .into_iter()
        .map(|result| NeedRatingsOutput {
            ratings: result.ratings,
            sum: result.sum,
            exist_value: result.exist_value,
            exist_ratings: result.exist_ratings,
            lack_value: result.lack_value,
            lack_ratings: result.lack_ratings,
        })
        .collect::<Vec<_>>();

    serde_json::to_string(&results).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[derive(Debug, Deserialize)]
struct ChemistryMetaInput {
    nations: Vec<i32>,
    leagues: Vec<i32>,
    clubs: Vec<i32>,
}

#[derive(Debug, Deserialize)]
struct CandidateOptionsRequest {
    players: Vec<Option<PlayerInput>>,
    skip_index: usize,
    target_chemistry: i32,
    meta: ChemistryMetaInput,
    club_leagues: HashMap<i32, i32>,
}

#[derive(Debug, Serialize)]
struct CandidateOutput {
    #[serde(skip_serializing_if = "Option::is_none")]
    nation_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    league_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    team_id: Option<i32>,
}

fn clean_candidate(candidate: PlayerIdentity) -> CandidateOutput {
    CandidateOutput {
        nation_id: (candidate.nation_id != UNSET_ID).then_some(candidate.nation_id),
        league_id: (candidate.league_id != UNSET_ID).then_some(candidate.league_id),
        team_id: (candidate.team_id != UNSET_ID).then_some(candidate.team_id),
    }
}

#[wasm_bindgen(js_name = fsuGenerateCandidateOptions)]
pub fn wasm_generate_candidate_options(request_json: &str) -> Result<String, JsValue> {
    let request: CandidateOptionsRequest =
        serde_json::from_str(request_json).map_err(|error| JsValue::from_str(&error.to_string()))?;

    let lookup = MapTeamLookup::new(request.club_leagues);
    let service = SbcChemistryService::new(lookup);

    let squad: Vec<Option<PlayerIdentity>> = request
        .players
        .into_iter()
        .map(|player| {
            player.map(|entry| {
                PlayerIdentity::new(entry.nation_id, entry.league_id, entry.team_id)
            })
        })
        .collect();

    let meta = ChemistryMeta {
        nations: request.meta.nations,
        leagues: request.meta.leagues,
        clubs: request.meta.clubs,
    };

    let results = service.generate_candidate_options(
        &squad,
        request.skip_index,
        request.target_chemistry,
        &meta,
    );

    let output = results.into_iter().map(clean_candidate).collect::<Vec<_>>();
    serde_json::to_string(&output).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen(js_name = fsuWasmVersion)]
pub fn wasm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}