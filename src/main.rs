mod library;
mod workspace;

use gpui_kit::*;
use workspace::Workspace;

fn main() {
    application().with_assets(assets::Assets).run(|cx| {
        init(cx);
        open_window(WindowOptions::default(), cx, |window, cx| {
            window.set_window_title("local-music");
            cx.new(|cx| Workspace::new(window, cx))
        })
        .expect("Failed to open local-music window");
    });
}
