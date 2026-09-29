use std::borrow::Cow;

use gpui_kit::{AssetSource, Result, SharedString, assets::Assets};

pub struct AppAssets;

impl AssetSource for AppAssets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        if path == "images/app-icon.svg" {
            return Ok(Some(Cow::Borrowed(include_bytes!(
                "../assets/app-icon.svg"
            ))));
        }
        Assets.load(path)
    }

    fn list(&self, prefix: &str) -> Result<Vec<SharedString>> {
        let mut paths = Assets.list(prefix)?;
        if "images/app-icon.svg".starts_with(prefix) {
            paths.push("images/app-icon.svg".into());
        }
        Ok(paths)
    }
}
