use std::{collections::BTreeMap, io::Write, path::PathBuf, process::ExitCode, sync::Arc};

use local_music_scanner::{Artwork, scan_folder};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrackPayload {
    path: String,
    title: String,
    artist: String,
    album: String,
    duration_seconds: u64,
    cover_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtworkPayload<'a> {
    id: &'a str,
    mime_type: &'a str,
    #[serde(with = "serde_bytes")]
    bytes: &'a [u8],
}

#[derive(Serialize)]
struct ScanPayload<'a> {
    version: u8,
    tracks: Vec<TrackPayload>,
    covers: Vec<ArtworkPayload<'a>>,
    skipped: usize,
}

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
    let mut covers: BTreeMap<String, Arc<Artwork>> = BTreeMap::new();
    let tracks = scan
        .tracks
        .into_iter()
        .map(|track| {
            let cover_id = track.cover.map(|image| {
                let id = image.id.to_string();
                covers.entry(id.clone()).or_insert(image);
                id
            });
            TrackPayload {
                path: track.path.to_string_lossy().into_owned(),
                title: track.title,
                artist: track.artist,
                album: track.album,
                duration_seconds: track.duration_seconds,
                cover_id,
            }
        })
        .collect();
    let artwork = covers
        .iter()
        .map(|(id, image)| ArtworkPayload {
            id,
            mime_type: image.mime_type,
            bytes: &image.bytes,
        })
        .collect();
    let payload = ScanPayload {
        version: 1,
        tracks,
        covers: artwork,
        skipped: scan.skipped,
    };
    let bytes = match rmp_serde::to_vec_named(&payload) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("Failed to encode scan result: {error}");
            return ExitCode::FAILURE;
        }
    };
    let Ok(length) = u32::try_from(bytes.len()) else {
        eprintln!("Scan result exceeds the protocol limit");
        return ExitCode::FAILURE;
    };
    let mut stdout = std::io::stdout().lock();
    if let Err(error) = stdout
        .write_all(&length.to_be_bytes())
        .and_then(|()| stdout.write_all(&bytes))
    {
        eprintln!("Failed to write scan result: {error}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
