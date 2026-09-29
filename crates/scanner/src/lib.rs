use std::{
    collections::HashMap,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::Arc,
};

use lofty::{
    file::{AudioFile, TaggedFileExt},
    picture::PictureType,
    prelude::Accessor,
    read_from_path,
    tag::Tag,
};
use walkdir::WalkDir;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Track {
    pub path: PathBuf,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: u64,
    pub cover: Option<Arc<Artwork>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Artwork {
    pub id: u64,
    pub mime_type: &'static str,
    pub bytes: Vec<u8>,
}

#[derive(Debug)]
pub struct ScanResult {
    pub tracks: Vec<Track>,
    pub skipped: usize,
}

pub fn scan_folder(folder: &Path) -> ScanResult {
    let mut tracks = Vec::new();
    let mut skipped = 0;
    let mut covers = HashMap::new();

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
                    cover: file
                        .tags()
                        .iter()
                        .find_map(|tag| cover_image(tag, &mut covers)),
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

fn cover_image(tag: &Tag, cache: &mut HashMap<u64, Arc<Artwork>>) -> Option<Arc<Artwork>> {
    let picture = tag
        .pictures()
        .iter()
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| tag.pictures().first())?;
    let data = picture.data();
    if data.len() > 8 * 1024 * 1024 {
        return None;
    }
    let mime_type = match picture.mime_type()?.as_str() {
        "image/png" => "image/png",
        "image/jpeg" | "image/jpg" => "image/jpeg",
        "image/webp" => "image/webp",
        "image/gif" => "image/gif",
        "image/svg+xml" => "image/svg+xml",
        "image/bmp" => "image/bmp",
        "image/tiff" | "image/tif" => "image/tiff",
        "image/ico" => "image/ico",
        "image/x-portable-anymap" => "image/x-portable-anymap",
        _ => return None,
    };
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    data.hash(&mut hasher);
    let id = hasher.finish();
    if let Some(image) = cache.get(&id)
        && image.bytes == data
    {
        return Some(image.clone());
    }
    let image = Arc::new(Artwork {
        id,
        mime_type,
        bytes: data.to_vec(),
    });
    cache.insert(id, image.clone());
    Some(image)
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
    use lofty::{
        picture::{MimeType, Picture},
        tag::TagType,
    };

    #[test]
    fn audio_extensions_are_case_insensitive() {
        assert!(is_audio(Path::new("track.FLAC")));
        assert!(is_audio(Path::new("track.m4a")));
        assert!(!is_audio(Path::new("cover.jpg")));
    }

    #[test]
    fn front_cover_is_shared_between_tracks() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.push_picture(Picture::new_unchecked(
            PictureType::CoverBack,
            Some(MimeType::Png),
            None,
            vec![1, 2, 3],
        ));
        tag.push_picture(Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Jpeg),
            None,
            vec![4, 5, 6],
        ));

        let mut cache = HashMap::new();
        let first = cover_image(&tag, &mut cache).expect("front cover is available");
        let second = cover_image(&tag, &mut cache).expect("front cover is cached");
        assert_eq!(first.mime_type, "image/jpeg");
        assert!(Arc::ptr_eq(&first, &second));
    }
}
