use ea_client::{
    ClubPlayer, ClubRatingInventory, ClubSnapshot, EaSession, GamePlatform, UtasClient,
};
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
    squad_rating: i32,
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
struct ChemistryPlanDto {
    total_chemistry: i32,
    nations: Vec<i32>,
    leagues: Vec<i32>,
    clubs: Vec<i32>,
    candidates: Vec<CandidateDto>,
}

#[derive(Debug, Serialize)]
struct ClubLeagueMapDto {
    club_leagues: HashMap<i32, i32>,
    player_count: usize,
}

#[derive(Debug, Serialize)]
struct ClubSnapshotDto {
    total_players: usize,
    rating_counts: HashMap<i32, i32>,
    club_leagues: HashMap<i32, i32>,
    players: Vec<ClubPlayerDto>,
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
struct ClubPlayerDto {
    id: i64,
    resource_id: i64,
    rating: i32,
    nation_id: i32,
    league_id: i32,
    team_id: i32,
    untradeable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    preferred_position: Option<String>,
}

#[derive(Debug, Serialize)]
struct ClubPlayersListDto {
    total_players: usize,
    players: Vec<ClubPlayerDto>,
}

#[derive(Debug, Serialize)]
struct PlanRatingWithClubDto {
    inventory: ClubInventoryDto,
    options: Vec<RatingNeedDto>,
}

const SQUAD_SIZE: usize = 11;

fn player_dto_to_identity(dto: &PlayerDto) -> Option<PlayerIdentity> {
    if dto.nation_id == UNSET_ID && dto.league_id == UNSET_ID && dto.team_id == UNSET_ID {
        None
    } else {
        Some(PlayerIdentity::new(dto.nation_id, dto.league_id, dto.team_id))
    }
}

fn squad_from_dtos(players: Vec<PlayerDto>) -> Vec<Option<PlayerIdentity>> {
    let mut squad = vec![None; SQUAD_SIZE];
    for (index, dto) in players.into_iter().take(SQUAD_SIZE).enumerate() {
        squad[index] = player_dto_to_identity(&dto);
    }
    squad
}

fn chemistry_service(club_leagues: Option<HashMap<i32, i32>>) -> SbcChemistryService<MapTeamLookup> {
    SbcChemistryService::new(MapTeamLookup::new(club_leagues.unwrap_or_default()))
}

fn map_candidate(candidate: PlayerIdentity) -> CandidateDto {
    CandidateDto {
        nation_id: (candidate.nation_id != UNSET_ID).then_some(candidate.nation_id),
        league_id: (candidate.league_id != UNSET_ID).then_some(candidate.league_id),
        team_id: (candidate.team_id != UNSET_ID).then_some(candidate.team_id),
    }
}

fn map_club_snapshot(snapshot: ClubSnapshot) -> ClubSnapshotDto {
    ClubSnapshotDto {
        total_players: snapshot.total_players,
        rating_counts: snapshot.rating_counts,
        club_leagues: snapshot.club_leagues,
        players: snapshot.players.into_iter().map(map_club_player).collect(),
    }
}

async fn load_club_snapshot(session: &EaSession) -> Result<ClubSnapshot, String> {
    UtasClient::new()
        .fetch_club_snapshot(session)
        .await
        .map_err(|error| error.to_string())
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

fn inventory_from_counts(rating_counts: HashMap<i32, i32>) -> ClubRatingInventory {
    let total_players = rating_counts.values().copied().sum::<i32>() as usize;
    ClubRatingInventory {
        total_players,
        rating_counts,
    }
}

fn inventory_to_rating_options(inventory: &ClubRatingInventory) -> (Vec<i32>, HashMap<i32, i32>) {
    let mut available_ratings: Vec<i32> = inventory.rating_counts.keys().copied().collect();
    available_ratings.sort_by(|left, right| right.cmp(left));
    (available_ratings, inventory.rating_counts.clone())
}

fn squad_rating_for_option(existing_ratings: &[i32], fill_ratings: &[i32]) -> i32 {
    let mut ratings = existing_ratings.to_vec();
    ratings.extend_from_slice(fill_ratings);
    team_rating_count(&ratings)
}

fn map_rating_need_results(
    results: Vec<fsu_core::RatingNeedResult>,
    existing_ratings: &[i32],
) -> Vec<RatingNeedDto> {
    results
        .into_iter()
        .map(|result| RatingNeedDto {
            squad_rating: squad_rating_for_option(existing_ratings, &result.ratings),
            ratings: result.ratings,
            sum: result.sum,
            exist_value: result.exist_value,
            lack_value: result.lack_value,
            lack_ratings: result.lack_ratings,
        })
        .collect()
}

fn normalize_brick_count(brick_count: Option<usize>) -> usize {
    brick_count.unwrap_or(0).min(11)
}

fn map_rating_needs(
    target: i32,
    existing_ratings: Vec<i32>,
    brick_count: usize,
    inventory: &ClubRatingInventory,
    price_by_rating: HashMap<i32, i32>,
) -> Vec<RatingNeedDto> {
    let (available_ratings, available_counts) = inventory_to_rating_options(inventory);

    let existing = existing_ratings.clone();
    map_rating_need_results(
        need_ratings_count(&RatingNeedOptions {
            target,
            existing_ratings,
            brick_count,
            available_ratings,
            available_counts,
            price_by_rating,
            squad_absent: false,
        }),
        &existing,
    )
}

fn map_club_player(player: ClubPlayer) -> ClubPlayerDto {
    ClubPlayerDto {
        id: player.id,
        resource_id: player.resource_id,
        rating: player.rating,
        nation_id: player.nation_id,
        league_id: player.league_id,
        team_id: player.team_id,
        untradeable: player.untradeable,
        preferred_position: player.preferred_position,
    }
}

async fn load_rating_prices(http: &ReqwestHttp, platform: &str) -> HashMap<i32, i32> {
    fetch_rating_lowprices(http.clone(), platform)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn calculate_sbc_chemistry(players: Vec<PlayerDto>, include_meta: bool) -> ChemistryDto {
    let service = SbcChemistryService::new(IdentityTeamLookup);
    let squad = squad_from_dtos(players);
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
fn plan_sbc_chemistry(
    players: Vec<PlayerDto>,
    skip_index: usize,
    target_chemistry: i32,
    club_leagues: Option<HashMap<i32, i32>>,
) -> ChemistryPlanDto {
    let service = chemistry_service(club_leagues);
    let squad = squad_from_dtos(players);
    let skip_index = skip_index.min(SQUAD_SIZE.saturating_sub(1));
    let result = service.calculate_chemistry(&squad, None, None, true);

    let meta = result.meta.unwrap_or(ChemistryMeta {
        nations: Vec::new(),
        leagues: Vec::new(),
        clubs: Vec::new(),
    });

    let candidates = service
        .generate_candidate_options(&squad, skip_index, target_chemistry, &meta)
        .into_iter()
        .map(map_candidate)
        .collect();

    ChemistryPlanDto {
        total_chemistry: result.total_chemistry,
        nations: meta.nations,
        leagues: meta.leagues,
        clubs: meta.clubs,
        candidates,
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
    brick_count: Option<usize>,
    platform: Option<String>,
) -> Result<Vec<RatingNeedDto>, String> {
    let price_by_rating = match platform.as_deref() {
        Some(platform) => load_rating_prices(&state.http, platform).await,
        None => HashMap::new(),
    };

    let existing = existing_ratings.unwrap_or_default();
    Ok(map_rating_need_results(
        need_ratings_count(&RatingNeedOptions {
            target,
            existing_ratings: existing.clone(),
            brick_count: normalize_brick_count(brick_count),
            available_ratings: Vec::new(),
            available_counts: HashMap::new(),
            price_by_rating,
            squad_absent: true,
        }),
        &existing,
    ))
}

#[tauri::command]
fn generate_candidate_options(
    players: Vec<PlayerDto>,
    skip_index: usize,
    target_chemistry: i32,
    meta: ChemistryMetaDto,
    club_leagues: HashMap<i32, i32>,
) -> Vec<CandidateDto> {
    let service = chemistry_service(Some(club_leagues));
    let squad = squad_from_dtos(players);
    let chemistry_meta = ChemistryMeta {
        nations: meta.nations,
        leagues: meta.leagues,
        clubs: meta.clubs,
    };

    service
        .generate_candidate_options(&squad, skip_index, target_chemistry, &chemistry_meta)
        .into_iter()
        .map(map_candidate)
        .collect()
}

#[tauri::command]
async fn fetch_club_snapshot(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> Result<ClubSnapshotDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let snapshot = load_club_snapshot(&session).await?;
    Ok(map_club_snapshot(snapshot))
}

#[tauri::command]
async fn fetch_club_league_map(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> Result<ClubLeagueMapDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let snapshot = load_club_snapshot(&session).await?;

    Ok(ClubLeagueMapDto {
        club_leagues: snapshot.club_leagues,
        player_count: snapshot.total_players,
    })
}

#[tauri::command]
async fn fetch_club_players(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> Result<ClubPlayersListDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let snapshot = load_club_snapshot(&session).await?;

    Ok(ClubPlayersListDto {
        total_players: snapshot.total_players,
        players: snapshot.players.into_iter().map(map_club_player).collect(),
    })
}

#[tauri::command]
async fn fetch_club_inventory(
    access_token: String,
    platform: String,
    persona_id: Option<String>,
) -> Result<ClubInventoryDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let snapshot = load_club_snapshot(&session).await?;

    Ok(ClubInventoryDto {
        total_players: snapshot.total_players,
        rating_counts: snapshot.rating_counts,
    })
}

#[tauri::command]
async fn plan_rating_from_inventory(
    state: tauri::State<'_, AppState>,
    target: i32,
    existing_ratings: Option<Vec<i32>>,
    brick_count: Option<usize>,
    rating_counts: HashMap<i32, i32>,
    platform: String,
) -> Result<PlanRatingWithClubDto, String> {
    let inventory = inventory_from_counts(rating_counts);
    let price_by_rating = load_rating_prices(&state.http, &platform).await;
    let options = map_rating_needs(
        target,
        existing_ratings.unwrap_or_default(),
        normalize_brick_count(brick_count),
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
async fn plan_rating_with_club(
    state: tauri::State<'_, AppState>,
    access_token: String,
    platform: String,
    persona_id: Option<String>,
    target: i32,
    existing_ratings: Option<Vec<i32>>,
    brick_count: Option<usize>,
) -> Result<PlanRatingWithClubDto, String> {
    let session = build_ea_session(access_token, &platform, persona_id);
    let snapshot = load_club_snapshot(&session).await?;
    let inventory = ClubRatingInventory {
        total_players: snapshot.total_players,
        rating_counts: snapshot.rating_counts,
    };

    let price_by_rating = load_rating_prices(&state.http, &platform).await;
    let options = map_rating_needs(
        target,
        existing_ratings.unwrap_or_default(),
        normalize_brick_count(brick_count),
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

#[cfg(test)]
mod tests {
    use super::*;
    use ea_client::build_club_league_map;

    #[test]
    fn squad_from_dtos_pads_to_eleven_slots() {
        let squad = squad_from_dtos(vec![PlayerDto {
            nation_id: 1,
            league_id: 10,
            team_id: 100,
        }]);

        assert_eq!(squad.len(), SQUAD_SIZE);
        assert_eq!(
            squad[0],
            Some(PlayerIdentity::new(1, 10, 100))
        );
        assert_eq!(squad[1], None);
    }

    #[test]
    fn empty_player_dto_maps_to_none_slot() {
        let squad = squad_from_dtos(vec![PlayerDto {
            nation_id: UNSET_ID,
            league_id: UNSET_ID,
            team_id: UNSET_ID,
        }]);

        assert_eq!(squad[0], None);
    }

    #[test]
    fn squad_rating_for_option_matches_team_rating_count() {
        let rating = squad_rating_for_option(&[90, 90, 88], &[84, 84, 84, 84, 84]);
        assert_eq!(rating, team_rating_count(&[90, 90, 88, 84, 84, 84, 84, 84]));
    }

    #[test]
    fn inventory_from_counts_sums_player_total() {
        let mut counts = HashMap::new();
        counts.insert(84, 3);
        counts.insert(83, 2);

        let inventory = inventory_from_counts(counts);
        assert_eq!(inventory.total_players, 5);
        assert_eq!(inventory.rating_counts.get(&84), Some(&3));
    }

    #[test]
    fn build_club_league_map_uses_team_to_league_pairs() {
        let players = vec![
            ClubPlayer {
                id: 1,
                resource_id: 1,
                rating: 84,
                nation_id: 14,
                league_id: 13,
                team_id: 5,
                untradeable: false,
                preferred_position: None,
            },
            ClubPlayer {
                id: 2,
                resource_id: 2,
                rating: 80,
                nation_id: 14,
                league_id: 16,
                team_id: 9,
                untradeable: false,
                preferred_position: None,
            },
        ];

        let map = build_club_league_map(&players);
        assert_eq!(map.get(&5), Some(&13));
        assert_eq!(map.get(&9), Some(&16));
    }
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
            plan_sbc_chemistry,
            fetch_club_snapshot,
            fetch_club_league_map,
            fetch_club_players,
            fetch_club_inventory,
            plan_rating_from_inventory,
            plan_rating_with_club,
            probe_ea_session,
            fetch_player_prices
        ])
        .run(tauri::generate_context!())
        .expect("error while running FSU Desktop");
}