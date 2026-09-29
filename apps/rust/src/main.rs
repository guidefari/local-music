mod appearance;
mod assets;
mod library;
mod library_view;
mod workspace;

use assets::AppAssets;
use gpui_kit::*;
use workspace::Workspace;

fn main() {
    application().with_assets(AppAssets).run(|cx| {
        init(cx);
        open_window(WindowOptions::default(), cx, |window, cx| {
            window.set_window_title("local-music");
            cx.new(|cx| Workspace::new(window, cx))
        })
        .expect("Failed to open local-music window");
    });
}
