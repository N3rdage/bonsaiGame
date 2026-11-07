// obj_ui_tree_rename — Create event
// Modal dialog for renaming a tree. Spawned by obj_ui_tree_inspector's
// Rename button. Uses GameMaker's `keyboard_string` for text input.
event_inherited();

panel_title = "Rename Tree";
panel_w     = 480;
panel_h     = 280;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

tree            = undefined;   // set by spawner immediately after instance_create_depth
name_max_length = 20;

// Initialise keyboard_string on the first draw frame — by then the spawner
// has set `tree`, so we can seed the input with the current name.
initialised = false;

draw_content = function() {
    if (!initialised) {
        keyboard_string = (tree == undefined) ? "" : tree.name;
        initialised = true;
    }

    if (tree == undefined) {
        draw_set_color(c_white);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_text(panel_x + 24, panel_y + 60, "No tree selected.");
        return;
    }

    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 24;

    draw_set_color(make_color_rgb(180, 180, 180));
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    var _current = (tree.name == "") ? "(unnamed)" : "\"" + tree.name + "\"";
    draw_text(_x, _y, "Current name: " + _current);
    _y += _line + 16;

    draw_set_color(c_white);
    draw_text(_x, _y, "New name:");
    _y += _line;

    // Input box
    var _box_x = _x;
    var _box_y = _y;
    var _box_w = panel_w - 48;
    var _box_h = 36;
    draw_set_color(make_color_rgb(20, 25, 20));
    draw_rectangle(_box_x, _box_y, _box_x + _box_w, _box_y + _box_h, false);
    draw_set_color(make_color_rgb(140, 160, 120));
    draw_rectangle(_box_x, _box_y, _box_x + _box_w, _box_y + _box_h, true);

    draw_set_color(c_white);
    draw_set_valign(fa_middle);
    var _text_y = _box_y + _box_h / 2;
    draw_text(_box_x + 8, _text_y, keyboard_string);

    // Blinking cursor
    if ((current_time div 500) mod 2 == 0) {
        var _cursor_x = _box_x + 8 + string_width(keyboard_string) + 1;
        draw_line(_cursor_x, _box_y + 6, _cursor_x, _box_y + _box_h - 6);
    }
    draw_set_valign(fa_top);

    _y += _box_h + 8;
    draw_set_color(make_color_rgb(140, 140, 140));
    draw_text(_x, _y,
        "Enter to save  |  ESC to cancel  |  "
        + string(string_length(keyboard_string))
        + "/" + string(name_max_length));

    // Buttons
    var _bw = 120;
    var _bh = 36;
    var _gap = 24;
    var _by = panel_y + panel_h - _bh - 20;
    var _cx = panel_x + panel_w / 2;

    if (ui_button(_cx - _gap / 2 - _bw, _by, _bw, _bh, "Cancel")) {
        instance_destroy();
    }
    if (ui_button(_cx + _gap / 2, _by, _bw, _bh, "Save")) {
        tree.name = keyboard_string;
        instance_destroy();
    }
};
