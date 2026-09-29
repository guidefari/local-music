use std::path::PathBuf;

use gpui_kit::component::{
    ActiveTheme, Disableable,
    button::Button,
    input::{Input, InputEvent, InputState},
    scroll::ScrollableElement,
};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::*;

use crate::{
    appearance,
    library::{ScanResult, Track, scan_folder},
    library_view,
};

pub struct Workspace {
    folder: Option<PathBuf>,
    tracks: Vec<Track>,
    search: Entity<InputState>,
    query: String,
    status: String,
    scanning: bool,
    _search_subscription: Subscription,
    _appearance_subscription: Subscription,
}

impl Workspace {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        appearance::follow_system(window, cx);
        let _appearance_subscription = cx.observe_window_appearance(window, |_, window, cx| {
            appearance::follow_system(window, cx);
            cx.notify();
        });
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
            _appearance_subscription,
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
                    .px_6()
                    .py_4()
                    .border_b_1()
                    .border_color(cx.theme().border)
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            .child(img("images/app-icon.svg").size_10())
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .child(
                                        div()
                                            .font_weight(FontWeight::SEMIBOLD)
                                            .child("local-music"),
                                    )
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(cx.theme().muted_foreground)
                                            .child("Your records, your way"),
                                    ),
                            ),
                    )
                    .child(
                        Button::new("choose-folder")
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
                    .flex_1()
                    .min_h_0()
                    .w_full()
                    .max_w(rems(80.))
                    .mx_auto()
                    .px_6()
                    .pt_6()
                    .gap_4()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1()
                            .child(
                                div()
                                    .text_xl()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child("Library"),
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(cx.theme().muted_foreground)
                                    .child(self.folder.as_ref().map_or_else(
                                        || {
                                            "Choose a folder to start exploring your music"
                                                .to_owned()
                                        },
                                        |folder| folder.display().to_string(),
                                    )),
                            ),
                    )
                    .child(
                        div()
                            .text_sm()
                            .text_color(cx.theme().muted_foreground)
                            .child(self.status.clone()),
                    )
                    .child(Input::new(&self.search))
                    .when(!self.tracks.is_empty(), |view| {
                        view.child(library_view::albums(&self.tracks, cx))
                    })
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .text_sm()
                            .text_color(cx.theme().muted_foreground)
                            .child("Tracks")
                            .child(if count > 500 {
                                format!("{count} matching · showing first 500")
                            } else {
                                format!("{count} matching tracks")
                            }),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_h_0()
                            .overflow_y_scrollbar()
                            .rounded_lg()
                            .border_1()
                            .border_color(cx.theme().border)
                            .child(library_view::track_rows(&filtered, cx)),
                    ),
            )
    }
}
