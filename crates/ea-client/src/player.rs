use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Parsed club player from a UTAS `itemData` entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClubPlayer {
    pub id: i64,
    pub resource_id: i64,
    pub rating: i32,
    pub nation_id: i32,
    pub league_id: i32,
    pub team_id: i32,
    pub untradeable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_position: Option<String>,
}

fn read_i64(value: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter().find_map(|key| value.get(*key).and_then(|entry| entry.as_i64()))
}

fn read_bool(value: &Value, keys: &[&str]) -> bool {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(|entry| entry.as_bool()))
        .unwrap_or(false)
}

fn read_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(|entry| entry.as_str())
            .map(str::to_string)
    })
}

/// Full club data from a single UTAS pagination pass.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClubSnapshot {
    pub total_players: usize,
    pub rating_counts: HashMap<i32, i32>,
    pub club_leagues: HashMap<i32, i32>,
    pub players: Vec<ClubPlayer>,
}

pub fn build_club_league_map(players: &[ClubPlayer]) -> HashMap<i32, i32> {
    players
        .iter()
        .filter(|player| player.team_id > 0 && player.league_id > 0)
        .map(|player| (player.team_id, player.league_id))
        .collect()
}

pub fn build_club_snapshot(players: Vec<ClubPlayer>) -> ClubSnapshot {
    let mut rating_counts: HashMap<i32, i32> = HashMap::new();
    for player in &players {
        *rating_counts.entry(player.rating).or_insert(0) += 1;
    }

    ClubSnapshot {
        total_players: players.len(),
        rating_counts,
        club_leagues: build_club_league_map(&players),
        players,
    }
}

/// Parse one UTAS club player item. Returns `None` when required fields are missing.
pub fn parse_club_player(item: &Value) -> Option<ClubPlayer> {
    let rating = read_i64(item, &["rating"])? as i32;
    let nation_id = read_i64(item, &["nation", "nationId"])? as i32;
    let league_id = read_i64(item, &["leagueId", "leagueid"])? as i32;
    let team_id = read_i64(item, &["teamid", "teamId"])? as i32;
    let id = read_i64(item, &["id"]).unwrap_or(0);
    let resource_id = read_i64(item, &["resourceId", "assetId", "definitionId"]).unwrap_or(0);

    Some(ClubPlayer {
        id,
        resource_id,
        rating,
        nation_id,
        league_id,
        team_id,
        untradeable: read_bool(item, &["untradeable", "untradeableCount"]),
        preferred_position: read_string(item, &["preferredPosition", "preferredposition"]),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_club_player_reads_utas_fields() {
        let item = json!({
            "id": 1001,
            "resourceId": 231747,
            "rating": 84,
            "nation": 14,
            "leagueId": 13,
            "teamid": 1,
            "untradeable": true,
            "preferredPosition": "ST"
        });

        let player = parse_club_player(&item).expect("player");
        assert_eq!(player.id, 1001);
        assert_eq!(player.resource_id, 231747);
        assert_eq!(player.rating, 84);
        assert_eq!(player.nation_id, 14);
        assert_eq!(player.league_id, 13);
        assert_eq!(player.team_id, 1);
        assert!(player.untradeable);
        assert_eq!(player.preferred_position.as_deref(), Some("ST"));
    }

    #[test]
    fn parse_club_player_accepts_camel_case_aliases() {
        let item = json!({
            "id": 2,
            "assetId": 99,
            "rating": 70,
            "nationId": 1,
            "leagueid": 10,
            "teamId": 100
        });

        let player = parse_club_player(&item).expect("player");
        assert_eq!(player.resource_id, 99);
        assert_eq!(player.nation_id, 1);
        assert_eq!(player.league_id, 10);
        assert_eq!(player.team_id, 100);
        assert!(!player.untradeable);
    }

    #[test]
    fn parse_club_player_rejects_missing_rating() {
        let item = json!({ "nation": 1, "leagueId": 2, "teamid": 3 });
        assert!(parse_club_player(&item).is_none());
    }

    #[test]
    fn build_club_snapshot_aggregates_counts_and_league_map() {
        let players = vec![
            ClubPlayer {
                id: 1,
                resource_id: 10,
                rating: 84,
                nation_id: 14,
                league_id: 13,
                team_id: 5,
                untradeable: false,
                preferred_position: Some("ST".into()),
            },
            ClubPlayer {
                id: 2,
                resource_id: 11,
                rating: 84,
                nation_id: 2,
                league_id: 16,
                team_id: 9,
                untradeable: true,
                preferred_position: None,
            },
        ];

        let snapshot = build_club_snapshot(players);
        assert_eq!(snapshot.total_players, 2);
        assert_eq!(snapshot.rating_counts.get(&84), Some(&2));
        assert_eq!(snapshot.club_leagues.get(&5), Some(&13));
        assert_eq!(snapshot.club_leagues.get(&9), Some(&16));
    }
}