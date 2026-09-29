use gpui_kit::component::theme::Theme;
use gpui_kit::{App, Window, WindowAppearance, px, rgb};

struct Palette {
    background: u32,
    surface: u32,
    foreground: u32,
    muted_foreground: u32,
    border: u32,
    accent: u32,
    accent_hover: u32,
    accent_foreground: u32,
    selection: u32,
}

const LIGHT: Palette = Palette {
    background: 0xF6F4EE,
    surface: 0xFFFEFA,
    foreground: 0x242B29,
    muted_foreground: 0x56635E,
    border: 0xD8DCD5,
    accent: 0x96502F,
    accent_hover: 0x7D4025,
    accent_foreground: 0xFFFFFF,
    selection: 0xEFE3D8,
};

const DARK: Palette = Palette {
    background: 0x191E1D,
    surface: 0x222A28,
    foreground: 0xF3F0E8,
    muted_foreground: 0xBEC7C0,
    border: 0x3E4945,
    accent: 0xDE9A73,
    accent_hover: 0xEDAF8D,
    accent_foreground: 0x19201E,
    selection: 0x3B3630,
};

pub fn follow_system(window: &mut Window, cx: &mut App) {
    Theme::sync_system_appearance(Some(window), cx);
    let palette = palette_for(window.appearance());

    Theme::update(cx, |theme| {
        theme.font_family = ".SystemUIFont".into();
        theme.mono_font_family = "Menlo".into();
        theme.font_size = px(15.);
        theme.background = rgb(palette.background).into();
        theme.foreground = rgb(palette.foreground).into();
        theme.group_box = rgb(palette.surface).into();
        theme.group_box_foreground = rgb(palette.foreground).into();
        theme.popover = rgb(palette.surface).into();
        theme.popover_foreground = rgb(palette.foreground).into();
        theme.input = rgb(palette.border).into();
        theme.border = rgb(palette.border).into();
        theme.muted = rgb(palette.selection).into();
        theme.muted_foreground = rgb(palette.muted_foreground).into();
        theme.primary = rgb(palette.accent).into();
        theme.primary_hover = rgb(palette.accent_hover).into();
        theme.primary_active = rgb(palette.accent_hover).into();
        theme.primary_foreground = rgb(palette.accent_foreground).into();
        theme.button_primary = rgb(palette.accent).into();
        theme.button_primary_hover = rgb(palette.accent_hover).into();
        theme.button_primary_foreground = rgb(palette.accent_foreground).into();
        theme.ring = rgb(palette.accent).into();
        theme.selection = rgb(palette.selection).into();
        theme.colors.list = rgb(palette.surface).into();
        theme.colors.list_hover = rgb(palette.selection).into();
        theme.sidebar = rgb(palette.background).into();
        theme.sidebar_foreground = rgb(palette.foreground).into();
        theme.sidebar_border = rgb(palette.border).into();
    });
}

fn palette_for(appearance: WindowAppearance) -> &'static Palette {
    if matches!(
        appearance,
        WindowAppearance::Dark | WindowAppearance::VibrantDark
    ) {
        &DARK
    } else {
        &LIGHT
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_appearance_selects_both_palettes() {
        assert_eq!(
            palette_for(WindowAppearance::Light).background,
            LIGHT.background
        );
        assert_eq!(
            palette_for(WindowAppearance::Dark).background,
            DARK.background
        );
        assert_eq!(
            palette_for(WindowAppearance::VibrantDark).background,
            DARK.background
        );
    }
}
