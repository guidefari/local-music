use std::path::PathBuf;

use gpui_kit::component::{
    ActiveTheme, Disableable,
    button::{Button, ButtonVariants},
    input::{Input, InputEvent, InputState},
    scroll::ScrollableElement,
};
use gpui_kit::*;

use crate::library::{ScanResult, Track, scan_folder};

pub struct Workspace {
    folder: Option<PathBuf>,
    tracks: Vec<Track>,
    search: Entity<InputState>,
    query: String,
    status: String,
    scanning: bool,
    _search_subscription: Subscription,
}

impl Workspace {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let search = cx.new(|cx| {
            InputState::new(window, cx).placeholder("Search tracks, artists, albums, or paths")
        });
        let _search_subscription = cx.subscribe_in(&search, window, |this, input, event, _, cx| {
            if matches!(event, InputEvent::Change) {
                this.query = input.read(cx).value().to_string();
                cx.notify();
            }
        });

        Self {
            folder: None,
            tracks: Vec::new(),
            search,
            query: String::new(),
            status: "Choose a music folder to get started.".to_owned(),
            scanning: false,
            _search_subscription,
        }
    }

    fn choose_folder(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(folder) = rfd::FileDialog::new().pick_folder() else {
            return;
        };

        self.status = format!("Scanning {}…", folder.display());
        self.scanning = true;
        cx.notify();

        let scan = cx.background_spawn(async move { (folder.clone(), scan_folder(&folder)) });
        cx.spawn_in(window, async move |this, cx| {
            let (folder, ScanResult { tracks, skipped }) = scan.await;
            this.update_in(cx, |this, _, cx| {
                this.status = format!("{} tracks indexed · {skipped} files skipped", tracks.len());
                this.folder = Some(folder);
                this.tracks = tracks;
                this.scanning = false;
                cx.notify();
            })
            .ok();
        })
        .detach();
    }
}

impl Render for Workspace {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let filtered: Vec<&Track> = self
            .tracks
            .iter()
            .filter(|track| track.matches(&self.query))
            .collect();
        let count = filtered.len();
        let rows = filtered.into_iter().take(500).map(|track| {
            div()
                .flex()
                .items_center()
                .justify_between()
                .gap_4()
                .border_b_1()
                .border_color(cx.theme().border)
                .py_2()
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1()
                        .child(track.title.clone())
                        .child(format!("{} · {}", track.artist, track.album)),
                )
                .child(format!(
                    "{}:{:02}",
                    track.duration_seconds / 60,
                    track.duration_seconds % 60
                ))
        });

        div()
            .flex()
            .flex_col()
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .gap_4()
                    .p_5()
                    .border_b_1()
                    .border_color(cx.theme().border)
                    .child(div().flex().flex_col().gap_1().child("local-music").child(
                        self.folder.as_ref().map_or_else(
                            || "Your local music, in one place".to_owned(),
                            |folder| folder.display().to_string(),
                        ),
                    ))
                    .child(
                        Button::new("choose-folder")
                            .primary()
                            .label(if self.folder.is_some() {
                                "Change folder"
                            } else {
                                "Choose folder"
                            })
                            .disabled(self.scanning)
                            .on_click(
                                cx.listener(|this, _, window, cx| this.choose_folder(window, cx)),
                            ),
                    ),
            )
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .p_5()
                    .child(self.status.clone())
                    .child(Input::new(&self.search))
                    .child(format!("{count} matching tracks")),
            )
            .child(div().flex_1().overflow_y_scrollbar().px_5().children(rows))
    }
}
