use std::path::{Path, PathBuf};

use lofty::{
    file::{AudioFile, TaggedFileExt},
    prelude::Accessor,
    read_from_path,
};
use walkdir::WalkDir;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Track {
    pub path: PathBuf,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: u64,
}

impl Track {
    pub fn matches(&self, query: &str) -> bool {
        let query = query.trim().to_lowercase();
        query.is_empty()
            || self.title.to_lowercase().contains(&query)
            || self.artist.to_lowercase().contains(&query)
            || self.album.to_lowercase().contains(&query)
            || self.path.to_string_lossy().to_lowercase().contains(&query)
    }
}

#[derive(Debug)]
pub struct ScanResult {
    pub tracks: Vec<Track>,
    pub skipped: usize,
}

pub fn scan_folder(folder: &Path) -> ScanResult {
    let mut tracks = Vec::new();
    let mut skipped = 0;

    for entry in WalkDir::new(folder).follow_links(false) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let path = entry.path();
        if !entry.file_type().is_file() || !is_audio(path) {
            continue;
        }

        match read_from_path(path) {
            Ok(file) => {
                let tag = file.primary_tag().or_else(|| file.first_tag());
                let fallback_title = path
                    .file_stem()
                    .map(|stem| stem.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Unknown title".to_owned());
                tracks.push(Track {
                    path: path.to_path_buf(),
                    title: tag
                        .and_then(|tag| tag.title())
                        .map(|title| title.into_owned())
                        .unwrap_or(fallback_title),
                    artist: tag
                        .and_then(|tag| tag.artist())
                        .map(|artist| artist.into_owned())
                        .unwrap_or_else(|| "Unknown artist".to_owned()),
                    album: tag
                        .and_then(|tag| tag.album())
                        .map(|album| album.into_owned())
                        .unwrap_or_else(|| "Unknown album".to_owned()),
                    duration_seconds: file.properties().duration().as_secs(),
                });
            }
            Err(_) => skipped += 1,
        }
    }

    tracks.sort_by(|a, b| {
        a.artist
            .to_lowercase()
            .cmp(&b.artist.to_lowercase())
            .then_with(|| a.album.to_lowercase().cmp(&b.album.to_lowercase()))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });

    ScanResult { tracks, skipped }
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mp3" | "m4a" | "flac" | "wav" | "aiff" | "aif" | "ogg" | "opus"
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_includes_metadata_and_file_path() {
        let track = Track {
            path: PathBuf::from("/Music/House/Example.flac"),
            title: "Example".to_owned(),
            artist: "Artist".to_owned(),
            album: "Record".to_owned(),
            duration_seconds: 100,
        };

        for query in ["example", "ARTIST", "record", "house", " "] {
            assert!(track.matches(query));
        }
        assert!(!track.matches("jazz"));
    }

    #[test]
    fn audio_extensions_are_case_insensitive() {
        assert!(is_audio(Path::new("track.FLAC")));
        assert!(is_audio(Path::new("track.m4a")));
        assert!(!is_audio(Path::new("cover.jpg")));
    }
}
