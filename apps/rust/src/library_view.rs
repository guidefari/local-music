use std::{collections::BTreeMap, sync::Arc};

use gpui_kit::component::ActiveTheme;
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::*;

use crate::library::Track;

fn cover(image: Option<&Arc<Image>>, size: Rems, cx: &App) -> AnyElement {
    let placeholder = || {
        div()
            .size(size)
            .flex()
            .items_center()
            .justify_center()
            .rounded_md()
            .bg(cx.theme().muted)
            .text_color(cx.theme().muted_foreground)
            .child("◉")
            .into_any_element()
    };

    match image {
        Some(image) => img(image.clone())
            .size(size)
            .object_fit(ObjectFit::Cover)
            .rounded_md()
            .with_fallback(move || {
                div()
                    .size(size)
                    .flex()
                    .items_center()
                    .justify_center()
                    .child("No cover")
                    .into_any_element()
            })
            .into_any_element(),
        None => placeholder(),
    }
}

pub fn albums(tracks: &[Track], cx: &App) -> impl IntoElement {
    let mut grouped: BTreeMap<(&str, &str), (usize, Option<&Arc<Image>>)> = BTreeMap::new();
    for track in tracks {
        let album = grouped.entry((&track.artist, &track.album)).or_default();
        album.0 += 1;
        if album.1.is_none() {
            album.1 = track.cover.as_ref();
        }
    }

    let count = grouped.len();
    let cards = grouped
        .into_iter()
        .take(4)
        .map(|((artist, album), (tracks, image))| {
            div()
                .flex()
                .items_center()
                .gap_4()
                .p_4()
                .min_w_64()
                .flex_1()
                .rounded_lg()
                .border_1()
                .border_color(cx.theme().border)
                .bg(cx.theme().group_box)
                .child(cover(image, rems(5.), cx))
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .min_w_0()
                        .gap_1()
                        .child(
                            div()
                                .font_weight(FontWeight::SEMIBOLD)
                                .child(album.to_owned()),
                        )
                        .child(
                            div()
                                .text_sm()
                                .text_color(cx.theme().muted_foreground)
                                .child(artist.to_owned()),
                        )
                        .child(
                            div()
                                .text_sm()
                                .text_color(cx.theme().muted_foreground)
                                .child(format!("{tracks} tracks")),
                        ),
                )
        });

    div()
        .flex()
        .flex_col()
        .gap_3()
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(div().font_weight(FontWeight::SEMIBOLD).child("Albums"))
                .child(
                    div()
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child(format!("{count} in this folder")),
                ),
        )
        .child(div().flex().flex_wrap().gap_3().children(cards))
}

pub fn track_rows(tracks: &[&Track], cx: &App) -> impl IntoElement {
    div()
        .flex()
        .flex_col()
        .when(tracks.is_empty(), |view| {
            view.child(
                div()
                    .p_8()
                    .text_color(cx.theme().muted_foreground)
                    .child("No tracks to show"),
            )
        })
        .children(tracks.iter().take(500).enumerate().map(|(index, track)| {
            div()
                .flex()
                .items_center()
                .gap_3()
                .border_b_1()
                .border_color(cx.theme().border)
                .px_4()
                .py_2()
                .bg(cx.theme().group_box)
                .child(
                    div()
                        .w_8()
                        .font_family("Menlo")
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child(format!("{:02}", index + 1)),
                )
                .child(cover(track.cover.as_ref(), rems(3.), cx))
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .flex_1()
                        .min_w_0()
                        .gap_1()
                        .child(
                            div()
                                .font_weight(FontWeight::MEDIUM)
                                .child(track.title.clone()),
                        )
                        .child(
                            div()
                                .text_sm()
                                .text_color(cx.theme().muted_foreground)
                                .child(format!("{} · {}", track.artist, track.album)),
                        ),
                )
                .child(
                    div()
                        .font_family("Menlo")
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child(format!(
                            "{}:{:02}",
                            track.duration_seconds / 60,
                            track.duration_seconds % 60
                        )),
                )
        }))
}
