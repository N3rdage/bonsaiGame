// obj_ui_settings — Create event
// Modal settings panel. Currently exposes fullscreen only — volume sliders
// will land alongside the audio pass (TODO: audio).
event_inherited();

panel_title = "Settings";
panel_w     = 460;
panel_h     = 280;
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

    // Close button at the bottom
    var _bw = 140;
    var _bh = 36;
    var _by = panel_y + panel_h - _bh - 20;
    var _bx = panel_x + (panel_w - _bw) / 2;
    if (ui_button(_bx, _by, _bw, _bh, "Close")) {
        on_close();
    }
};
