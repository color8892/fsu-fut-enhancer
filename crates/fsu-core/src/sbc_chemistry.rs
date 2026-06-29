//! SBC squad chemistry — ported from `extension/src/fsu/domain/SbcChemistryService.js`.

use fsu_types::{PlayerIdentity, TeamInfo, UNSET_ID};
use std::collections::{HashMap, HashSet};

/// Resolves linked clubs and team metadata for chemistry candidate generation.
pub trait TeamLookup {
    fn get_team_link(&self, team_id: i32) -> i32;
    fn get_team(&self, club_id: i32) -> Option<TeamInfo>;
}

/// Team lookup backed by a club → league map (WASM / desktop bridges).
#[derive(Debug, Clone, Default)]
pub struct MapTeamLookup {
    pub club_leagues: HashMap<i32, i32>,
}

impl MapTeamLookup {
    pub fn new(club_leagues: HashMap<i32, i32>) -> Self {
        Self { club_leagues }
    }
}

impl TeamLookup for MapTeamLookup {
    fn get_team_link(&self, team_id: i32) -> i32 {
        team_id
    }

    fn get_team(&self, club_id: i32) -> Option<TeamInfo> {
        self.club_leagues
            .get(&club_id)
            .map(|&league_id| TeamInfo { league_id })
    }
}

/// Identity team lookup (no links, no team metadata).
pub struct IdentityTeamLookup;

impl TeamLookup for IdentityTeamLookup {
    fn get_team_link(&self, team_id: i32) -> i32 {
        team_id
    }

    fn get_team(&self, _club_id: i32) -> Option<TeamInfo> {
        None
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChemistryMeta {
    pub nations: Vec<i32>,
    pub leagues: Vec<i32>,
    pub clubs: Vec<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChemistryResult {
    pub total_chemistry: i32,
    pub player_chemistry: Option<i32>,
    pub meta: Option<ChemistryMeta>,
}

pub struct SbcChemistryService<L: TeamLookup> {
    lookup: L,
}

impl<L: TeamLookup> SbcChemistryService<L> {
    pub fn new(lookup: L) -> Self {
        Self { lookup }
    }

    pub fn get_chemistry_points_by_threshold(count: i32, thresholds: [i32; 3]) -> i32 {
        if count >= thresholds[2] {
            3
        } else if count >= thresholds[1] {
            2
        } else if count >= thresholds[0] {
            1
        } else {
            0
        }
    }

    pub fn calculate_chemistry(
        &self,
        base_players: &[Option<PlayerIdentity>],
        skip_index: Option<usize>,
        candidate: Option<PlayerIdentity>,
        include_meta: bool,
    ) -> ChemistryResult {
        let mut nation_count: HashMap<i32, i32> = HashMap::new();
        let mut league_count: HashMap<i32, i32> = HashMap::new();
        let mut club_count: HashMap<i32, i32> = HashMap::new();
        let mut nation_set: HashSet<i32> = HashSet::new();
        let mut league_set: HashSet<i32> = HashSet::new();
        let mut club_set: HashSet<i32> = HashSet::new();

        let mut count_player = |player: PlayerIdentity| {
            if player.nation_id != UNSET_ID {
                *nation_count.entry(player.nation_id).or_insert(0) += 1;
                if include_meta {
                    nation_set.insert(player.nation_id);
                }
            }
            if player.league_id != UNSET_ID {
                *league_count.entry(player.league_id).or_insert(0) += 1;
                if include_meta {
                    league_set.insert(player.league_id);
                }
            }
            if player.team_id != UNSET_ID {
                let linked = self.lookup.get_team_link(player.team_id);
                *club_count.entry(linked).or_insert(0) += 1;
                if include_meta {
                    club_set.insert(player.team_id);
                }
            }
        };

        for (player_index, player) in base_players.iter().enumerate() {
            let Some(player) = player else { continue };
            if skip_index == Some(player_index) {
                continue;
            }
            count_player(*player);
        }

        if let Some(candidate) = candidate {
            count_player(candidate);
        }

        let nation_points: HashMap<i32, i32> = nation_count
            .iter()
            .map(|(&id, &count)| (id, Self::get_chemistry_points_by_threshold(count, [2, 5, 8])))
            .collect();

        let league_points: HashMap<i32, i32> = league_count
            .iter()
            .map(|(&id, &count)| (id, Self::get_chemistry_points_by_threshold(count, [3, 5, 8])))
            .collect();

        let club_points: HashMap<i32, i32> = club_count
            .iter()
            .map(|(&id, &count)| (id, Self::get_chemistry_points_by_threshold(count, [2, 4, 7])))
            .collect();

        let player_chemistry_for = |player: PlayerIdentity| -> i32 {
            let mut chemistry = 0;
            if player.nation_id != UNSET_ID {
                chemistry += nation_points.get(&player.nation_id).copied().unwrap_or(0);
            }
            if player.league_id != UNSET_ID {
                chemistry += league_points.get(&player.league_id).copied().unwrap_or(0);
            }
            if player.team_id != UNSET_ID {
                let linked = self.lookup.get_team_link(player.team_id);
                chemistry += club_points.get(&linked).copied().unwrap_or(0);
            }
            chemistry.min(3)
        };

        let mut total_chemistry = 0;
        for (player_index, player) in base_players.iter().enumerate() {
            let Some(player) = player else { continue };
            if skip_index == Some(player_index) {
                continue;
            }
            total_chemistry += player_chemistry_for(*player);
        }

        let mut player_chemistry = None;
        if let Some(candidate) = candidate {
            let chem = player_chemistry_for(candidate);
            player_chemistry = Some(chem);
            total_chemistry += chem;
        }

        let meta = if include_meta {
            let mut nations: Vec<i32> = nation_set.into_iter().collect();
            let mut leagues: Vec<i32> = league_set.into_iter().collect();
            let mut clubs: Vec<i32> = club_set.into_iter().collect();
            nations.sort_unstable();
            leagues.sort_unstable();
            clubs.sort_unstable();
            Some(ChemistryMeta {
                nations,
                leagues,
                clubs,
            })
        } else {
            None
        };

        ChemistryResult {
            total_chemistry,
            player_chemistry,
            meta,
        }
    }

    pub fn generate_candidate_options(
        &self,
        players: &[Option<PlayerIdentity>],
        skip_index: usize,
        target_chemistry: i32,
        meta: &ChemistryMeta,
    ) -> Vec<PlayerIdentity> {
        let mut result = Vec::new();
        let mut result_keys = HashSet::new();

        let mut push_candidate = |candidate: PlayerIdentity| -> bool {
            let key = format!(
                "{}_{}_{}",
                candidate.nation_id, candidate.league_id, candidate.team_id
            );
            if result_keys.contains(&key) {
                return true;
            }

            let chemistry = self.calculate_chemistry(players, Some(skip_index), Some(candidate), false);
            if chemistry.total_chemistry >= target_chemistry {
                result.push(candidate);
                result_keys.insert(key);
                return true;
            }
            false
        };

        let mut pending_nations = Vec::new();
        for &nation_id in &meta.nations {
            if !push_candidate(PlayerIdentity::new(nation_id, UNSET_ID, UNSET_ID)) {
                pending_nations.push(nation_id);
            }
        }

        let mut pending_leagues = Vec::new();
        for &league_id in &meta.leagues {
            if !push_candidate(PlayerIdentity::new(UNSET_ID, league_id, UNSET_ID)) {
                pending_leagues.push(league_id);
            }
        }

        let mut club_league_map: HashMap<i32, i32> = HashMap::new();
        for &club_id in &meta.clubs {
            if let Some(team) = self.lookup.get_team(club_id) {
                club_league_map.insert(club_id, team.league_id);
            }
        }

        let mut pending_clubs = Vec::new();
        for &club_id in &meta.clubs {
            let Some(league) = club_league_map.get(&club_id).copied() else {
                continue;
            };
            if !pending_leagues.contains(&league) {
                continue;
            }
            if !push_candidate(PlayerIdentity::new(UNSET_ID, league, club_id)) {
                pending_clubs.push(club_id);
            }
        }

        let mut success_nation_league: HashMap<i32, HashSet<i32>> = HashMap::new();
        for &nation_id in &pending_nations {
            for &league_id in &pending_leagues {
                if push_candidate(PlayerIdentity::new(nation_id, league_id, UNSET_ID)) {
                    success_nation_league
                        .entry(league_id)
                        .or_default()
                        .insert(nation_id);
                }
            }
        }

        for &nation_id in &pending_nations {
            for &club_id in &pending_clubs {
                let Some(league) = club_league_map.get(&club_id).copied() else {
                    continue;
                };
                let Some(nations) = success_nation_league.get(&league) else {
                    continue;
                };
                if !nations.contains(&nation_id) {
                    continue;
                }
                push_candidate(PlayerIdentity::new(nation_id, league, club_id));
            }
        }

        result
            .into_iter()
            .map(|candidate| {
                PlayerIdentity::new(
                    if candidate.nation_id != UNSET_ID {
                        candidate.nation_id
                    } else {
                        UNSET_ID
                    },
                    if candidate.league_id != UNSET_ID {
                        candidate.league_id
                    } else {
                        UNSET_ID
                    },
                    if candidate.team_id != UNSET_ID {
                        candidate.team_id
                    } else {
                        UNSET_ID
                    },
                )
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_players() -> Vec<Option<PlayerIdentity>> {
        vec![
            Some(PlayerIdentity::new(1, 10, 100)),
            Some(PlayerIdentity::new(1, 10, 101)),
            Some(PlayerIdentity::new(2, 11, 200)),
        ]
    }

    #[test]
    fn chemistry_points_by_threshold_matches_js() {
        assert_eq!(
            SbcChemistryService::<IdentityTeamLookup>::get_chemistry_points_by_threshold(8, [2, 5, 8]),
            3
        );
        assert_eq!(
            SbcChemistryService::<IdentityTeamLookup>::get_chemistry_points_by_threshold(1, [2, 5, 8]),
            0
        );
    }

    #[test]
    fn calculate_chemistry_total_is_non_negative() {
        let service = SbcChemistryService::new(IdentityTeamLookup);
        let players = sample_players();
        let result = service.calculate_chemistry(&players, None, None, false);
        assert!(result.total_chemistry >= 0);
    }

    #[test]
    fn calculate_chemistry_with_meta_matches_js() {
        let service = SbcChemistryService::new(IdentityTeamLookup);
        let players = sample_players();
        let result = service.calculate_chemistry(&players, Some(0), None, true);

        let meta = result.meta.expect("meta should be present");
        assert!(meta.nations.contains(&1));
        assert!(meta.leagues.contains(&10));
    }

    #[test]
    fn calculate_chemistry_with_candidate() {
        let service = SbcChemistryService::new(IdentityTeamLookup);
        let players = sample_players();
        let candidate = PlayerIdentity::new(1, 10, 102);
        let result = service.calculate_chemistry(&players, None, Some(candidate), false);

        assert!(result.player_chemistry.is_some());
        assert!(result.total_chemistry >= result.player_chemistry.unwrap_or(0));
    }
}