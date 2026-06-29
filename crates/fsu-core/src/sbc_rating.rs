//! SBC squad rating calculations — ported from `SbcRatingService.js`.

use std::collections::HashMap;

/// EA FUT squad rating from player OVR values (up to 11 slots).
pub fn team_rating_count(ratings: &[i32]) -> i32 {
    let mut sum: f64 = ratings.iter().map(|&r| r as f64).sum();
    let avg = sum / 11.0;

    for &value in ratings {
        let value = value as f64;
        if value > avg {
            sum += value - avg;
        }
    }

    (sum.round() / 11.0).floor() as i32
}

/// Squad rating after applying fill cards to an existing squad.
pub fn squad_rating_for_fill(existing_ratings: &[i32], fill_ratings: &[i32]) -> i32 {
    let mut ratings = existing_ratings.to_vec();
    ratings.extend_from_slice(fill_ratings);
    team_rating_count(&ratings)
}

/// Multicombinations: choose `count` items from `items` allowing repeats, order matters.
/// Ported from `lodashMixins.js` / `_.multicombinations`.
pub fn multicombinations(items: &[i32], count: i32) -> Vec<Vec<i32>> {
    fn combine(working: &[i32], remaining: i32, out: &mut Vec<Vec<i32>>) {
        let remaining = remaining - 1;
        if remaining < 0 {
            out.push(vec![]);
            return;
        }

        let mut working = working.to_vec();
        while !working.is_empty() {
            let current = working[0];
            let mut sub_results = Vec::new();
            combine(&working, remaining, &mut sub_results);

            for mut combo in sub_results {
                combo.insert(0, current);
                out.push(combo);
            }

            working.remove(0);
        }
    }

    let mut results = Vec::new();
    combine(items, count, &mut results);
    results
}

#[derive(Debug, Clone)]
pub struct RatingNeedOptions {
    pub target: i32,
    pub existing_ratings: Vec<i32>,
    pub brick_count: usize,
    pub available_ratings: Vec<i32>,
    pub available_counts: HashMap<i32, i32>,
    pub price_by_rating: HashMap<i32, i32>,
    /// When true, ignores club counts and treats all simulated picks as obtainable.
    pub squad_absent: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RatingNeedResult {
    pub ratings: Vec<i32>,
    pub sum: i32,
    pub exist_value: i32,
    pub exist_ratings: Vec<i32>,
    pub lack_value: i32,
    pub lack_ratings: Vec<i32>,
}

/// Top simulation picks to reach a target squad rating.
/// Ported from `SbcRatingService.needRatingsCount` (data-only subset).
pub fn need_ratings_count(options: &RatingNeedOptions) -> Vec<RatingNeedResult> {
    let ratings = options.existing_ratings.clone();
    let brick = options.brick_count;
    let lack_number = 11usize.saturating_sub(brick).saturating_sub(ratings.len());

    if lack_number == 0 {
        return Vec::new();
    }

    let have_ratings = if options.squad_absent {
        (45..=99).rev().collect::<Vec<_>>()
    } else {
        let mut uniq: Vec<i32> = options
            .available_ratings
            .iter()
            .copied()
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        uniq.sort_by(|a, b| b.cmp(a));
        uniq
    };

    let have_ratings_count = if options.squad_absent {
        HashMap::new()
    } else {
        options.available_counts.clone()
    };

    let lack_simulation: Vec<Vec<i32>> = have_ratings
        .iter()
        .map(|&rating| vec![rating; lack_number])
        .collect();

    let fill_number: usize = match lack_number {
        n if n <= 3 => 9,
        4 => 8,
        5 => 7,
        6 => 6,
        _ => 5,
    };

    let fill_offset = (fill_number / 2).saturating_sub(1);
    let mut basis_rating = 0;

    for combo in &lack_simulation {
        if !combo.is_empty() && team_rating_count(&concat_slices(&ratings, combo)) >= options.target {
            basis_rating = combo[0];
        }
    }

    let basis_index = have_ratings.iter().position(|&r| r == basis_rating).unwrap_or(0);
    let slice_start = basis_index.saturating_sub(fill_offset);
    let slice_end = (basis_index + fill_number - fill_offset).min(have_ratings.len());
    let slice = &have_ratings[slice_start..slice_end];

    let simulated = multicombinations(slice, lack_number as i32);
    let mut simulated_json = Vec::new();

    for combo in simulated {
        let simulated_count = team_rating_count(&concat_slices(&ratings, &combo));
        if simulated_count < options.target {
            continue;
        }

        let mut counts: HashMap<i32, i32> = HashMap::new();
        for &rating in &combo {
            *counts.entry(rating).or_insert(0) += 1;
        }

        let mut exist_value = 0;
        let mut lack_value = 0;
        let mut exist_ratings = Vec::new();
        let mut lack_ratings = Vec::new();

        for (&rating, &value) in &counts {
            let rating_price = options.price_by_rating.get(&rating).copied().unwrap_or(0);
            let have_count = if options.squad_absent {
                value
            } else {
                have_ratings_count.get(&rating).copied().unwrap_or(0)
            };

            exist_ratings.extend(std::iter::repeat_n(rating, have_count as usize));

            let used = have_count.min(value);
            exist_value += rating_price * used;
            if have_count < value {
                let missing = value - have_count;
                lack_value += rating_price * missing;
                lack_ratings.extend(std::iter::repeat_n(rating, missing as usize));
            }
        }

        simulated_json.push(RatingNeedResult {
            ratings: combo.clone(),
            sum: combo.iter().sum(),
            exist_value,
            exist_ratings,
            lack_value,
            lack_ratings,
        });
    }

    simulated_json.sort_by(|left, right| {
        left.lack_value
            .cmp(&right.lack_value)
            .then(left.exist_value.cmp(&right.exist_value))
            .then(left.sum.cmp(&right.sum))
    });

    simulated_json.truncate(3);
    simulated_json
}

fn concat_slices(left: &[i32], right: &[i32]) -> Vec<i32> {
    let mut out = Vec::with_capacity(left.len() + right.len());
    out.extend_from_slice(left);
    out.extend_from_slice(right);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn team_rating_all_equal_cards() {
        let ratings = vec![80; 11];
        assert_eq!(team_rating_count(&ratings), 80);
    }

    #[test]
    fn squad_rating_for_fill_combines_existing_and_fill() {
        let rating = squad_rating_for_fill(&[90, 90, 88], &[84, 84, 84, 84, 84]);
        assert_eq!(rating, team_rating_count(&[90, 90, 88, 84, 84, 84, 84, 84]));
    }

    #[test]
    fn team_rating_high_low_mix() {
        let ratings = vec![90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 50];
        assert_eq!(team_rating_count(&ratings), 89);
    }

    #[test]
    fn multicombinations_count_two() {
        let combos = multicombinations(&[70, 71], 2);
        assert_eq!(combos.len(), 3);
        assert!(combos.contains(&vec![70, 70]));
        assert!(combos.contains(&vec![70, 71]));
        assert!(combos.contains(&vec![71, 71]));
    }

    #[test]
    fn need_ratings_count_returns_options_for_target() {
        let options = RatingNeedOptions {
            target: 84,
            existing_ratings: vec![],
            brick_count: 0,
            available_ratings: Vec::new(),
            available_counts: HashMap::new(),
            price_by_rating: HashMap::new(),
            squad_absent: true,
        };

        let results = need_ratings_count(&options);
        assert!(!results.is_empty());
        assert!(results.len() <= 3);
        for result in &results {
            assert_eq!(result.ratings.len(), 11);
            assert!(team_rating_count(&result.ratings) >= 84);
        }
    }
}