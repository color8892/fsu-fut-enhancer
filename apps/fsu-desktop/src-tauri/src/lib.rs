use ea_client::{ClubRatingInventory, EaSession, GamePlatform, UtasClient};
use fsu_core::{
    fetch_rating_lowprices, need_ratings_count, price_last_diff, team_rating_count, ApiPlatform,
    ChemistryMeta, HttpGet, IdentityTeamLookup, MapTeamLookup, PriceFetchError, PriceService,
    RatingNeedOptions, SbcChemistryService,
};
use fsu_types::{PlayerIdentity, PriceType, UNSET_ID};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone)]
struct ReqwestHttp {
    client: reqwest::Client,
}

impl ReqwestHttp {
    fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

impl HttpGet for ReqwestHttp {
    async fn get(&self, url: &str) -> Result<String, PriceFetchError> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| PriceFetchError::Http(error.to_string()))?;

        response
            .text()
            .await
            .map_err(|error| PriceFetchError::Http(error.to_string()))
    }
}

struct AppState {
    prices: PriceService,
    http: ReqwestHttp,
}

#[derive(Debug, Deserialize)]
struct PlayerDto {
    nation_id: i32,
    league_id: i32,
    team_id: i32,
}

#[derive(Debug, Serialize)]
struct ChemistryDto {
    total_chemistry: i32,
    player_chemistry: Option<i32>,
    nations: Option<Vec<i32>>,
    leagues: Option<Vec<i32>>,
    clubs: Option<Vec<i32>>,
}

#[derive(Debug, Serialize)]
struct PriceEntryDto {
    definition_id: i32,
    amount: i32,
    price_type: PriceType,
}

#[derive(Debug, Serialize)]
struct RatingNeedDto {
    ratings: Vec<i32>,
    sum: i32,
    exist_value: i32,
    lack_value: i32,
    lack_ratings: Vec<i32>,
}

#[derive(Debug, Deserialize)]
struct ChemistryMetaDto {
    nations: Vec<i32>,
    leagues: Vec<i32>,
    clubs: Vec<i32>,
}

#[derive(Debug, Serialize)]
struct CandidateDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    nation_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    league_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    team_id: Option<i32>,
}

#[derive(Debug, Serialize)]
struct EaSessionProbeDto {
    ready: bool,
    message: String,
    platform: String,
    persona_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ClubInventoryDto {
    total_players: usize,
    rating_counts: HashMap<i32, i32>,
}

#[derive(Debug, Serialize)]
struct PlanRatingWithClubDto {
    inventory: ClubInventoryDto,
    options: Vec<RatingNeedDto>,
}

fn build_ea_session(
    access_token: String,
    platform: &str,
    persona_id: Option<String>,
) -> EaSession {
    let game_platform = match platform {
        "pc" => GamePlatform::Pc,
        "xbox" => GamePlatform::Xbox,
        _ => GamePlatform::Ps,
    };

    let mut session = EaSession::new(access_token.trim(), game_platform);
    if let Some(persona) = persona_id.filter(|value| !value.trim().is_empty()) {
        session = session.with_persona(persona.trim());
    }
    session
}

fn inventory_to_rating_options(inventory: &ClubRatingInventory) -> (Vec<i32>, HashMap<i32, i32>) {
    let mut available_ratings: Vec<i32> = inventory.rating_counts.keys().copied().collect();
    available_ratings.sort_by(|left, right| right.cmp(left));
    (available_ratings, inventory.rating_counts.clone())
}

fn map_rating_need_results(results: Vec<fsu_core::RatingNeedResult>) -> Vec<RatingNeedDto> {
    results
        .into_iter()
        .map(|result| RatingNeedDto {
            ratings: result.ratings,
            sum: result.sum,
            exist_value: result.exist_value,
            lack_value: result.lack_value,
            lack_ratings: result.lack_ratings,
        })
        .collect()
}

fn map_rating_needs(
    target: i32,
    existing_ratings: Vec<i32>,
    inventory: &ClubRatingInventory,
    price_by_rating: HashMap<i32, i32>,
) -> Vec<RatingNeedDto> {
    let (available_ratings, available_counts) = inventory_to_rating_options(inventory);

    map_rating_need_results(need_ratings_count(&RatingNeedOptions {
        target,
        existing_ratings,
        brick_count: 0,
        available_ratings,
        available_counts,
        price_by_rating,
        squad_absent: false,
    }))
}

async fn load_rating_prices(http: &ReqwestHttp, platform: &str) -> HashMap<i32, i32> {
    fetch_rating_lowprices(http.clone(), platform)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn calculate_sbc_chemistry(players: Vec<PlayerDto>, include_meta: bool) -> ChemistryDto {
    let service = SbcChemistryService::new(IdentityTeamLookup);
    let squad: Vec<Option<PlayerIdentity>> = players
        .into_iter()
        .map(|p| {
            Some(PlayerIdentity::new(
                p.nation_id,
                p.league_id,
                p.team_id,
            ))
        })
        .collect();

    let result = service.calculate_chemistry(&squad, None, None, include_meta);

    ChemistryDto {
        total_chemistry: result.total_chemistry,
        player_chemistry: result.player_chemistry,
        nations: result.meta.as_ref().map(|m| m.nations.clone()),
        leagues: result.meta.as_ref().map(|m| m.leagues.clone()),
        clubs: result.meta.as_ref().map(|m| m.clubs.clone()),
    }
}

#[tauri::command]
fn calculate_team_rating(ratings: Vec<i32>) -> i32 {
    team_rating_count(&ratings)
}

#[tauri::command]
fn format_price_diff(purchase_price: i64, last_price: i64) -> String {
    price_last_diff(purchase_price, last_price)
}

#[tauri::command]
async fn simulate_rating_needs(
    state: tauri::State<'_, AppState>,
    target: i32,
    existing_ratings: Option<Vec<i32>>,
    platform: Option<String>,
) -> Result<Vec<RatingNeedDto>, String> {
    let price_by_rating = match platform.as_deref() {
        Some(platform) => load_rating_prices(&state.http, platform).await,
        None => HashMap::new(),
    };

    Ok(map_rating_need_results(need_ratings_count(&RatingNeedOptions {
        target,
        existing_ratings: existing_ratings.unwrap_or_default(),
        brick_count: 0,
        available_ratings: Vec::new(),
        available_counts: HashMap::new(),
        price_by_rating,
        squad_absent: true,
    })))
}

#[tauri::command]
fn generate_candidate_options(
    players: Vec<PlayerDto>,
    skip_index: usize,
    target_chemistry: i32,
    meta: ChemistryMetaDto,
    club_leagues: HashMap<i32, i32>,
) -> Vec<CandidateDto> {
    let service = SbcChemistryService::new(MapTeamLookup::new(club_leagues));
    let squad: Vec<Option<PlayerIdentity>> = players
        .into_iter()
        .map(|player| {
            Some(PlayerIdentity::new(
                player.nation_id,
                player.league_id,
                player.team_id,
            ))
        })
        .collect();

    let chemistry_meta = ChemistryMeta {
        nations: meta.nations,
        leagues: meta.leagues,
        clubs: meta.clubs,
    };

    service
        .generate_candidate_options(&squad, skip_index, target_chemistry, &chemistry_meta)
        .into_iter()
        .map(|candidate| CandidateDto {
            nation_id: (candidate.nation_id != UNSET_ID).then_some(candidate.nation_id),
            league_id: (candidate.league_id != UNSET_ID).then_some(candidate.league_id),
            team_id: (candidate.team_id != UNSET_ID).then_some(candidate.team_id),
        })
        .collect()
}

#[tauri::command]
async fn fetch_club_inventory(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> Result<ClubInventoryDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let inventory = UtasClient::new()
        .fetch_club_inventory(&session)
        .await
        .map_err(|error| error.to_string())?;

    Ok(ClubInventoryDto {
        total_players: inventory.total_players,
        rating_counts: inventory.rating_counts,
    })
}

#[tauri::command]
async fn plan_rating_with_club(
    state: tauri::State<'_, AppState>,
    access_token: String,
    platform: String,
    persona_id: Option<String>,
    target: i32,
    existing_ratings: Option<Vec<i32>>,
) -> Result<PlanRatingWithClubDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let client = UtasClient::new();
    let inventory = client
        .fetch_club_inventory(&session)
        .await
        .map_err(|error| error.to_string())?;

    let price_by_rating = load_rating_prices(&state.http, &platform).await;
    let options = map_rating_needs(
        target,
        existing_ratings.unwrap_or_default(),
        &inventory,
        price_by_rating,
    );

    Ok(PlanRatingWithClubDto {
        inventory: ClubInventoryDto {
            total_players: inventory.total_players,
            rating_counts: inventory.rating_counts,
        },
        options,
    })
}

#[tauri::command]
async fn probe_ea_session(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> EaSessionProbeDto {
    let session = build_ea_session(access_token, &platform, persona_id);
    let game_platform = session.game_platform;

    let client = UtasClient::new();
    let (ready, message) = match client.fetch_club_players(&session).await {
        Ok(result) => (
            true,
            format!(
                "Club fetch OK — {} players in first page.",
                result.player_count
            ),
        ),
        Err(error) => (false, error.to_string()),
    };

    EaSessionProbeDto {
        ready,
        message,
        platform: game_platform.as_utas_param().to_string(),
        persona_id: session.persona_id,
    }
}

#[tauri::command]
async fn fetch_player_prices(
    state: tauri::State<'_, AppState>,
    definition_ids: Vec<i32>,
    platform: String,
) -> Result<Vec<PriceEntryDto>, String> {
    let game_platform = if platform == "pc" { "pc" } else { "ps" };

    let prices = state
        .prices
        .get_price_for_url(
            state.http.clone(),
            ApiPlatform::FutGg,
            game_platform,
            None,
            &definition_ids,
        )
        .await
        .map_err(|error| error.to_string())?;

    Ok(prices
        .into_iter()
        .map(|(definition_id, entry)| PriceEntryDto {
            definition_id,
            amount: entry.amount,
            price_type: entry.price_type,
        })
        .collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            prices: PriceService::new(),
            http: ReqwestHttp::new(),
        })
        .invoke_handler(tauri::generate_handler![
            calculate_sbc_chemistry,
            calculate_team_rating,
            simulate_rating_needs,
            format_price_diff,
            generate_candidate_options,
            fetch_club_inventory,
            plan_rating_with_club,
            probe_ea_session,
            fetch_player_prices
        ])
        .run(tauri::generate_context!())
        .expect("error while running FSU Desktop");
}