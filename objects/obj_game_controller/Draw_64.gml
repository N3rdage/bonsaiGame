// obj_game_controller — Draw GUI event
// Always-visible HUD: current day + money. Top-right corner.
draw_set_halign(fa_right);
draw_set_valign(fa_top);
draw_set_color(c_white);
draw_text(display_get_gui_width() - 16, 4,
    "Day " + string(global.game_day) + "  |  $" + string(global.money));
draw_set_halign(fa_left);

// Tutorial corner panel — only when an active step is in progress and no
// modal panel is up (so its Skip button doesn't accept clicks through a modal).
if (global.tutorial_step != TUT_DONE && !instance_exists(obj_ui_panel)) {
    var _gw = display_get_gui_width();
    var _w  = 340;
    var _h  = 110;
    var _px = _gw - _w - 16;
    var _py = 32;

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
    draw_text(_px + 12, _py + 26, tutorial_step_label(global.tutorial_step));
    draw_set_color(make_color_rgb(190, 190, 190));
    draw_text_ext(_px + 12, _py + 46, tutorial_step_body(global.tutorial_step), 16, _w - 24);

    if (ui_button(_px + _w - 70, _py + _h - 30, 60, 22, "Skip")) {
        if (!instance_exists(obj_ui_tutorial_skip_confirm)) {
            instance_create_depth(0, 0, -1000, obj_ui_tutorial_skip_confirm);
        }
    }
    draw_set_halign(fa_left);
}
