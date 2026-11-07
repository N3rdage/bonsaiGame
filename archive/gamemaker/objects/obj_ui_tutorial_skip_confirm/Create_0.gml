// obj_ui_tutorial_skip_confirm — Create event
// Modal confirmation for skipping the tutorial. Cheap insurance against an
// accidental click on the corner panel's Skip link.
event_inherited();

panel_title = "Skip Tutorial?";
panel_w     = 440;
panel_h     = 220;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

draw_content = function() {
    var _x = panel_x + 24;
    var _y = panel_y + 60;
    var _line = 22;

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text_ext(_x, _y, "The corner prompts will go away and you'll be on your own.",
        _line, panel_w - 48);
    _y += _line * 2 + 8;

    draw_set_color(make_color_rgb(180, 180, 180));
    draw_text_ext(_x, _y, "You can still figure things out by walking up to objects and pressing E.",
        _line, panel_w - 48);

    var _bw = 120;
    var _bh = 36;
    var _gap = 24;
    var _by = panel_y + panel_h - _bh - 20;
    var _cx = panel_x + panel_w / 2;

    if (ui_button(_cx - _gap / 2 - _bw, _by, _bw, _bh, "Cancel")) {
        instance_destroy();
    }
    if (ui_button(_cx + _gap / 2, _by, _bw, _bh, "Skip")) {
        tutorial_skip();
        instance_destroy();
    }
};
