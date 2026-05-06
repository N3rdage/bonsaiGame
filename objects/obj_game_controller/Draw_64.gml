// obj_game_controller — Draw GUI event
// Always-visible HUD: current day + money. Top-right corner.
draw_set_halign(fa_right);
draw_set_valign(fa_top);
draw_set_color(c_white);
draw_text(display_get_gui_width() - 16, 4,
    "Day " + string(global.game_day) + "  |  $" + string(global.money));
draw_set_halign(fa_left);

// Tutorial corner panel — visible across all rooms while a step is active.
// Stays drawn even when a modal (e.g. the tree inspector) is open so the
// player can read the next step without closing the modal; only the Skip
// button's click is gated on no-modal so the modal can't be skipped through.
// Auto-sizes height to fit the body text. Drops to bottom-right in the 3D
// viewer to clear that room's top toolbar.
if (global.tutorial_step != TUT_DONE) {
    var _gw = display_get_gui_width();
    var _gh = display_get_gui_height();
    var _w  = 340;

    var _label_y = 26;
    var _body_y  = 46;
    var _body_w  = _w - 24;
    var _body_h  = string_height_ext(tutorial_step_body(global.tutorial_step), 16, _body_w);
    var _skip_h  = 22;
    var _skip_gap = 8;
    var _bot_pad = 12;
    var _h = _body_y + _body_h + _skip_gap + _skip_h + _bot_pad;

    var _px = _gw - _w - 16;
    var _py = (room == rm_viewer_3d) ? (_gh - _h - 16) : 32;

    draw_set_alpha(0.85);
    draw_set_color(make_color_rgb(28, 34, 26));
    draw_rectangle(_px, _py, _px + _w, _py + _h, false);
    draw_set_alpha(1);
    draw_set_color(make_color_rgb(170, 200, 150));
    draw_rectangle(_px, _py, _px + _w, _py + _h, true);

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(make_color_rgb(170, 200, 150));
    draw_text(_px + 12, _py + 8, "Tutorial");
    draw_set_color(c_white);
    draw_text(_px + 12, _py + _label_y, tutorial_step_label(global.tutorial_step));
    draw_set_color(make_color_rgb(190, 190, 190));
    draw_text_ext(_px + 12, _py + _body_y, tutorial_step_body(global.tutorial_step), 16, _body_w);

    var _skip_y = _py + _body_y + _body_h + _skip_gap;

    // J-for-notebook hint sits opposite the Skip button so players discover
    // the longer reference exists.
    draw_set_color(make_color_rgb(140, 160, 130));
    draw_text(_px + 12, _skip_y + 4, "J — open notebook");

    if (!instance_exists(obj_ui_panel)) {
        if (ui_button(_px + _w - 70, _skip_y, 60, _skip_h, "Skip")) {
            instance_create_depth(0, 0, -1000, obj_ui_tutorial_skip_confirm);
        }
    } else {
        // Modal is up — draw the Skip button disabled so it still reads as a
        // button but doesn't fire (and clicks intended for the modal don't
        // accidentally hit it).
        ui_button(_px + _w - 70, _skip_y, 60, _skip_h, "Skip", false);
    }
    draw_set_halign(fa_left);
}
