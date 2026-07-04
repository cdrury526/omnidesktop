use crate::db::Db;

use super::search::{list_pages, search, DocMeta};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveHit {
    #[serde(flatten)]
    pub doc: DocMeta,
    pub score: i64,
}

pub async fn resolve_topic(
    db: &Db,
    topic: &str,
    mirror: Option<&str>,
    limit: u32,
) -> Result<Vec<ResolveHit>, String> {
    let query = topic.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let query_norm = normalize_compact(query);
    let query_words = split_words(query);
    let mut hits: Vec<ResolveHit> = list_pages(db, mirror, None)
        .await?
        .into_iter()
        .filter_map(|doc| {
            let score = score_doc(&doc, &query_norm, &query_words);
            (score > 0).then_some(ResolveHit { doc, score })
        })
        .collect();

    for (idx, hit) in search(db, query, mirror, None, None, 25)
        .await?
        .iter()
        .enumerate()
    {
        if let Some(existing) = hits.iter_mut().find(|candidate| candidate.doc.id == hit.id) {
            existing.score += 5_000 - idx as i64 * 50;
        } else {
            hits.push(ResolveHit {
                doc: DocMeta {
                    id: hit.id,
                    mirror: hit.mirror.clone(),
                    layer: hit.layer.clone(),
                    category: hit.category.clone(),
                    slug: hit.slug.clone(),
                    title: hit.title.clone(),
                    rel_path: hit.rel_path.clone(),
                    bytes: hit.byte_size,
                },
                score: 4_000 - idx as i64 * 50,
            });
        }
    }

    hits.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| layer_weight(&b.doc.layer).cmp(&layer_weight(&a.doc.layer)))
            .then_with(|| a.doc.rel_path.cmp(&b.doc.rel_path))
    });
    hits.truncate(limit as usize);
    Ok(hits)
}

fn score_doc(doc: &DocMeta, query_norm: &str, query_words: &[String]) -> i64 {
    let title = doc.title.as_deref().unwrap_or("");
    let title_norm = normalize_compact(title);
    let slug_norm = normalize_compact(&doc.slug);
    let path_norm = normalize_compact(&doc.rel_path);
    let category_norm = normalize_compact(&doc.category);

    let mut score = 0;
    for (value, exact_weight, contains_weight) in [
        (&slug_norm, 10_000, 4_000),
        (&title_norm, 9_000, 3_500),
        (&path_norm, 8_000, 3_000),
        (&category_norm, 5_000, 1_000),
    ] {
        if value == query_norm {
            score += exact_weight;
        } else if value.contains(query_norm) {
            score += contains_weight;
        }
    }

    let target_words = split_words(&format!(
        "{} {} {} {}",
        doc.slug,
        title,
        doc.category,
        doc.rel_path.replace('/', " ")
    ));
    if !query_words.is_empty() && query_words.iter().all(|word| target_words.contains(word)) {
        score += 2_500;
    }
    for query_word in query_words {
        score += score_word(query_word, &target_words);
    }

    score + layer_weight(&doc.layer)
}

fn score_word(query_word: &str, target_words: &[String]) -> i64 {
    let mut best = 0;
    for target in target_words {
        if target == query_word {
            best = best.max(600);
        } else if target.starts_with(query_word) || query_word.starts_with(target) {
            best = best.max(250);
        } else if query_word.len() >= 5 && edit_distance(query_word, target) <= 2 {
            best = best.max(150);
        }
    }
    best
}

fn split_words(value: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut prev_lower = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            if ch.is_ascii_uppercase() && prev_lower && !current.is_empty() {
                words.push(current.clone());
                current.clear();
            }
            current.push(ch.to_ascii_lowercase());
            prev_lower = ch.is_ascii_lowercase() || ch.is_ascii_digit();
        } else {
            if !current.is_empty() {
                words.push(current.clone());
                current.clear();
            }
            prev_lower = false;
        }
    }
    if !current.is_empty() {
        words.push(current);
    }
    words.sort();
    words.dedup();
    words
}

fn normalize_compact(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn layer_weight(layer: &str) -> i64 {
    match layer {
        "official" => 50,
        "published" => 40,
        "guides" => 30,
        "source" => 20,
        "reference" => 10,
        _ => 0,
    }
}

fn edit_distance(a: &str, b: &str) -> usize {
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut curr = vec![0; b.len() + 1];

    for (i, ca) in a.bytes().enumerate() {
        curr[0] = i + 1;
        for (j, cb) in b.bytes().enumerate() {
            let cost = usize::from(ca != cb);
            curr[j + 1] = (curr[j] + 1).min(prev[j + 1] + 1).min(prev[j] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b.len()]
}
