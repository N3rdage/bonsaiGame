// obj_ui_settings — Create event
// Modal settings panel. Currently exposes fullscreen only — volume sliders
// will land alongside the audio pass (TODO: audio).
event_inherited();

panel_title = "Settings";
panel_w     = 460;
panel_h     = 320;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

draw_content = function() {
    var _x = panel_x + 24;
    var _y = panel_y + 64;
    var _line = 32;

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    draw_text(_x, _y + 6, "Fullscreen");
    if (ui_toggle(_x + 200, _y, 160, 28,
                  global.settings.fullscreen ? "On" : "Off",
                  global.settings.fullscreen)) {
        global.settings.fullscreen = !global.settings.fullscreen;
        apply_settings();
        save_settings();
    }
    _y += _line + 8;

    // Window scale — only meaningful when not fullscreen; greyed out otherwise.
    var _scale_enabled = !global.settings.fullscreen;
    draw_set_color(_scale_enabled ? c_white : make_color_rgb(140, 140, 140));
    draw_text(_x, _y + 6, "Window scale");
    var _sw = 48;
    var _sgap = 8;
    for (var _s = 1; _s <= 3; _s++) {
        var _bx = _x + 200 + (_s - 1) * (_sw + _sgap);
        if (ui_toggle(_bx, _y, _sw, 28, string(_s) + "x",
                      global.settings.scale == _s, _scale_enabled)) {
            global.settings.scale = _s;
            apply_settings();
            save_settings();
        }
    }
    _y += _line + 8;

    // Ambient weather particles (seasonal, in the garden + shed). Purely
    // cosmetic; off for players who prefer a still scene.
    draw_set_color(c_white);
    draw_text(_x, _y + 6, "Weather effects");
    var _won = weather_enabled();
    if (ui_toggle(_x + 200, _y, 160, 28, _won ? "On" : "Off", _won)) {
        global.settings.weather = !_won;
        save_settings();
    }
    _y += _line + 8;

    // Close button at the bottom
    var _bw = 140;
    var _bh = 36;
    var _by = panel_y + panel_h - _bh - 20;
    var _bx = panel_x + (panel_w - _bw) / 2;
    if (ui_button(_bx, _by, _bw, _bh, "Close")) {
        on_close();
    }
};
