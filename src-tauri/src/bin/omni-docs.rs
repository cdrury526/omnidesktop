//! Headless CLI for the local documentation index.
//! Uses the same omni.db schema as the desktop app (migration 0004+).

use clap::{Parser, Subcommand};
use omni_desktop_lib::db;
use omni_desktop_lib::docs::{
    find_symbols, ingest_mirror, ingest_root, list_categories, list_layers, list_mirrors,
    list_pages, open_chunk, open_page, open_page_json, resolve_topic, search, search_chunks, stats,
    IngestReport,
};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "omni-docs",
    about = "Search and ingest local SDK documentation mirrors"
)]
struct Cli {
    /// SQLite database path (default: $OMNI_DB, app data dir, or ./data/omni.db)
    #[arg(long)]
    db: Option<PathBuf>,

    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Walk docs/ (or a mirror) and upsert into the DB
    Ingest {
        /// Mirror root or parent `docs/` directory
        #[arg(default_value = "docs")]
        path: PathBuf,
    },
    /// Full-text search (returns excerpts, not full files)
    Search {
        query: String,
        #[arg(long)]
        mirror: Option<String>,
        #[arg(long)]
        layer: Option<String>,
        #[arg(long)]
        category: Option<String>,
        #[arg(long, default_value_t = 12)]
        limit: u32,
        /// Print only paths (for scripting)
        #[arg(long)]
        paths: bool,
        /// Emit JSON array of hits
        #[arg(long)]
        json: bool,
        /// Search heading-level chunks instead of full pages
        #[arg(long)]
        chunks: bool,
    },
    /// Print chunk content by chunk row id
    OpenChunk { id: i64 },
    /// Print full document content by row id
    Open {
        id: i64,
        /// Print filesystem path only
        #[arg(long)]
        path: bool,
        /// Emit JSON metadata plus content
        #[arg(long)]
        json: bool,
    },
    /// List indexed mirrors, layers, or categories
    List {
        #[arg(long)]
        mirror: Option<String>,
        #[arg(long)]
        layer: Option<String>,
        /// Emit JSON page metadata matching the filters
        #[arg(long)]
        json: bool,
    },
    /// Print a catalog of indexed pages
    Index {
        /// Token-efficient one-line output: mirror | layer | category | slug | title
        #[arg(long)]
        compact: bool,
        #[arg(long)]
        mirror: Option<String>,
    },
    /// Fuzzy lookup for the best matching document
    Resolve {
        topic: String,
        #[arg(long)]
        mirror: Option<String>,
        /// Print the top three matches instead of only the best one
        #[arg(long)]
        top3: bool,
        /// Emit JSON array of matches
        #[arg(long)]
        json: bool,
    },
    /// Find exported/API symbols in reference files
    Symbol {
        name: String,
        #[arg(long)]
        mirror: Option<String>,
        #[arg(long, default_value_t = 12)]
        limit: u32,
        /// Emit JSON array of matches
        #[arg(long)]
        json: bool,
    },
    /// Row counts per mirror/layer
    Stats,
}

#[tokio::main]
async fn main() -> Result<(), String> {
    let cli = Cli::parse();
    let db_path = resolve_db_path(cli.db);
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let database = db::init(db_path.clone()).await?;

    match cli.cmd {
        Command::Ingest { path } => {
            let path = path.canonicalize().map_err(|e| format!("path: {e}"))?;
            let reports = if is_mirror_dir(&path) {
                vec![ingest_mirror(&database, &path).await?]
            } else {
                ingest_root(&database, &path).await?
            };
            if reports.is_empty() {
                eprintln!("no mirrors found under {}", path.display());
            }
            for r in reports {
                print_report(&r);
            }
        }
        Command::Search {
            query,
            mirror,
            layer,
            category,
            limit,
            paths,
            json,
            chunks,
        } => {
            if chunks {
                let hits = search_chunks(
                    &database,
                    &query,
                    mirror.as_deref(),
                    layer.as_deref(),
                    category.as_deref(),
                    limit,
                )
                .await?;
                if json {
                    print_json(&hits)?;
                    return Ok(());
                }
                if hits.is_empty() {
                    println!("(no matches)");
                    return Ok(());
                }
                for h in hits {
                    if paths {
                        println!("{}:{}", h.mirror, h.rel_path);
                    } else {
                        let title = h.title.as_deref().unwrap_or(&h.slug);
                        let location = if h.category.is_empty() {
                            format!("{} / {}", h.mirror, h.layer)
                        } else {
                            format!("{} / {} / {}", h.mirror, h.layer, h.category)
                        };
                        println!(
                            "[chunk:{} page:{}] {} > {}  {}  ({}b)\n  {}\n  → {}/{}\n",
                            h.id,
                            h.page_id,
                            title,
                            h.heading,
                            location,
                            h.byte_size,
                            h.excerpt,
                            h.mirror,
                            h.rel_path
                        );
                    }
                }
                return Ok(());
            }

            let hits = search(
                &database,
                &query,
                mirror.as_deref(),
                layer.as_deref(),
                category.as_deref(),
                limit,
            )
            .await?;
            if json {
                print_json(&hits)?;
                return Ok(());
            }
            if hits.is_empty() {
                println!("(no matches)");
                return Ok(());
            }
            for h in hits {
                if paths {
                    println!("{}:{}", h.mirror, h.rel_path);
                } else {
                    let title = h.title.as_deref().unwrap_or(&h.slug);
                    let location = if h.category.is_empty() {
                        format!("{} / {}", h.mirror, h.layer)
                    } else {
                        format!("{} / {} / {}", h.mirror, h.layer, h.category)
                    };
                    println!(
                        "[{}] {}  {}  ({}b)\n  {}\n  → {}/{}\n",
                        h.id, title, location, h.byte_size, h.excerpt, h.mirror, h.rel_path
                    );
                }
            }
        }
        Command::OpenChunk { id } => {
            let Some(chunk) = open_chunk(&database, id).await? else {
                return Err(format!("no chunk with id {id}"));
            };
            println!(
                "// {}/{}#{}\n",
                chunk.mirror,
                chunk.rel_path,
                slugify_heading(&chunk.heading)
            );
            print!("{}", chunk.content);
        }
        Command::Open { id, path, json } => {
            if json {
                let Some(page) = open_page_json(&database, id).await? else {
                    return Err(format!("no document with id {id}"));
                };
                print_json(&page)?;
                return Ok(());
            }
            let Some((abs, content)) = open_page(&database, id).await? else {
                return Err(format!("no document with id {id}"));
            };
            if path {
                println!("{abs}");
            } else {
                println!("// {abs}\n");
                print!("{content}");
            }
        }
        Command::List {
            mirror,
            layer,
            json,
        } => {
            if json {
                let pages = list_pages(&database, mirror.as_deref(), layer.as_deref()).await?;
                print_json(&pages)?;
                return Ok(());
            }
            if mirror.is_none() && layer.is_none() {
                for m in list_mirrors(&database).await? {
                    println!("{m}");
                }
            } else if layer.is_none() {
                let m = mirror.as_deref();
                for l in list_layers(&database, m).await? {
                    println!("{l}");
                }
            } else {
                for c in list_categories(&database, mirror.as_deref(), layer.as_deref()).await? {
                    println!("{c}");
                }
            }
        }
        Command::Index { compact, mirror } => {
            if !compact {
                return Err("index currently supports only --compact".to_string());
            }
            let pages = list_pages(&database, mirror.as_deref(), None).await?;
            for page in pages {
                println!(
                    "{} | {} | {} | {} | {}",
                    compact_field(&page.mirror),
                    compact_field(&page.layer),
                    compact_field(&page.category),
                    compact_field(&page.slug),
                    compact_field(page.title.as_deref().unwrap_or(&page.slug)),
                );
            }
        }
        Command::Resolve {
            topic,
            mirror,
            top3,
            json,
        } => {
            let limit = if top3 { 3 } else { 1 };
            let hits = resolve_topic(&database, &topic, mirror.as_deref(), limit).await?;
            if json {
                print_json(&hits)?;
                return Ok(());
            }
            if hits.is_empty() {
                println!("(no matches)");
                return Ok(());
            }
            for hit in hits {
                let title = hit.doc.title.as_deref().unwrap_or(&hit.doc.slug);
                println!(
                    "[{} score:{}] {}  {} / {} / {}\n  → {}/{}",
                    hit.doc.id,
                    hit.score,
                    title,
                    hit.doc.mirror,
                    hit.doc.layer,
                    display_category(&hit.doc.category),
                    hit.doc.mirror,
                    hit.doc.rel_path
                );
            }
        }
        Command::Symbol {
            name,
            mirror,
            limit,
            json,
        } => {
            let hits = find_symbols(&database, &name, mirror.as_deref(), limit).await?;
            if json {
                print_json(&hits)?;
                return Ok(());
            }
            if hits.is_empty() {
                println!("(no matches)");
                return Ok(());
            }
            for hit in hits {
                println!(
                    "[{}] {} ({})  {}:{}\n  {}\n  → {}/{}",
                    hit.id,
                    hit.name,
                    hit.kind,
                    hit.rel_path,
                    hit.line,
                    hit.snippet,
                    hit.mirror,
                    hit.rel_path
                );
            }
        }
        Command::Stats => {
            let rows = stats(&database).await?;
            let mut total = 0i64;
            for (mirror, layer, n) in rows {
                total += n;
                println!("{mirror:30} {layer:12} {n:5}");
            }
            println!("{total} pages total");
        }
    }
    Ok(())
}

fn is_mirror_dir(path: &std::path::Path) -> bool {
    path.join("_provenance").is_dir()
        || [
            "official",
            "published",
            "source",
            "reference",
            "guides",
            "index",
        ]
        .iter()
        .any(|l| path.join(l).is_dir())
}

fn resolve_db_path(flag: Option<PathBuf>) -> PathBuf {
    if let Some(p) = flag {
        return p;
    }
    if let Ok(p) = std::env::var("OMNI_DB") {
        return PathBuf::from(p);
    }
    if let Ok(home) = std::env::var("HOME") {
        let app = PathBuf::from(home).join(".local/share/com.drury.omni-desktop/omni.db");
        if app.exists() {
            return app;
        }
    }
    PathBuf::from("data/omni.db")
}

fn print_report(r: &IngestReport) {
    println!(
        "{}: scanned={} inserted={} updated={} skipped={} removed={}",
        r.mirror, r.scanned, r.inserted, r.updated, r.skipped, r.removed
    );
}

fn print_json<T: serde::Serialize>(value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    println!("{json}");
    Ok(())
}

fn compact_field(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace('|', "/")
}

fn display_category(value: &str) -> &str {
    if value.is_empty() {
        "-"
    } else {
        value
    }
}

fn slugify_heading(value: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in value.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}
