use std::{collections::BTreeMap, path::PathBuf, process::ExitCode};

use base64::{Engine, engine::general_purpose::STANDARD};
use local_music_scanner::scan_folder;
use serde_json::json;

fn main() -> ExitCode {
    let Some(folder) = std::env::args_os().nth(1).map(PathBuf::from) else {
        eprintln!("Usage: local-music-scan <folder>");
        return ExitCode::FAILURE;
    };
    if !folder.is_dir() {
        eprintln!("Not a music folder: {}", folder.display());
        return ExitCode::FAILURE;
    }

    let scan = scan_folder(&folder);
    let mut covers = BTreeMap::new();
    let tracks: Vec<_> = scan
        .tracks
        .into_iter()
        .map(|track| {
            let cover_id = track.cover.map(|image| {
                let id = image.id.to_string();
                covers.entry(id.clone()).or_insert_with(|| {
                    format!(
                        "data:{};base64,{}",
                        image.mime_type,
                        STANDARD.encode(&image.bytes)
                    )
                });
                id
            });
            json!({
                "path": track.path.to_string_lossy(),
                "title": track.title,
                "artist": track.artist,
                "album": track.album,
                "durationSeconds": track.duration_seconds,
                "coverId": cover_id,
            })
        })
        .collect();
    let output = json!({ "tracks": tracks, "covers": covers, "skipped": scan.skipped });
    if let Err(error) = serde_json::to_writer(std::io::stdout(), &output) {
        eprintln!("Failed to write scan result: {error}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
