// obj_ui_tree_style_picker — Create event
// Modal style-picker for a tree's target_style. Spawned by the tree
// inspector's "Set Style" button.
event_inherited();

panel_title = "Tree Style";
panel_w     = 600;
panel_h     = 540;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

tree         = undefined;   // set by spawner immediately after instance_create_depth
selected_key = "";          // initialised on first draw frame from tree.target_style
initialised  = false;

draw_content = function() {
    if (!initialised) {
        selected_key = (tree == undefined) ? "" : tree.target_style;
        initialised = true;
    }

    if (tree == undefined) {
        draw_set_color(c_white);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_text(panel_x + 20, panel_y + 60, "No tree selected.");
        return;
    }

    var _x = panel_x + 20;
    var _y = panel_y + 50;

    draw_set_color(make_color_rgb(200, 200, 200));
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "Pick a target style for this tree.");
    _y += 28;

    var _row_w = panel_w - 40;
    var _row_h = 56;
    var _row_gap = 4;
    var _mx = device_mouse_x_to_gui(0);
    var _my = device_mouse_y_to_gui(0);

    var _style_keys = struct_get_names(global.styles);
    for (var i = 0; i < array_length(_style_keys); i++) {
        var _key   = _style_keys[i];
        var _style = global.styles[$ _key];
        var _is_selected = (selected_key == _key);

        var _row_x = _x;
        var _row_y = _y;
        var _hover = _mx >= _row_x && _mx <= _row_x + _row_w
                  && _my >= _row_y && _my <= _row_y + _row_h;

        if (_is_selected) {
            draw_set_color(make_color_rgb(70, 100, 60));
            draw_rectangle(_row_x, _row_y, _row_x + _row_w, _row_y + _row_h, false);
        } else if (_hover) {
            draw_set_color(make_color_rgb(45, 55, 45));
            draw_rectangle(_row_x, _row_y, _row_x + _row_w, _row_y + _row_h, false);
        }
        draw_set_color(make_color_rgb(140, 160, 120));
        draw_rectangle(_row_x, _row_y, _row_x + _row_w, _row_y + _row_h, true);

        draw_set_color(c_white);
        draw_text(_row_x + 12, _row_y + 8, _style.display_name);
        draw_set_color(make_color_rgb(180, 180, 180));
        draw_text(_row_x + 12, _row_y + 30, _style.description);

        if (_hover && mouse_check_button_pressed(mb_left)) {
            selected_key = _key;
        }

        _y += _row_h + _row_gap;
    }

    // Footer buttons: Clear, Cancel, Save
    var _bw = 120;
    var _bh = 36;
    var _gap = 16;
    var _by = panel_y + panel_h - _bh - 20;
    var _total_w = _bw * 3 + _gap * 2;
    var _bx_start = panel_x + (panel_w - _total_w) / 2;

    if (ui_button(_bx_start, _by, _bw, _bh, "Clear")) {
        selected_key = "";
    }
    if (ui_button(_bx_start + _bw + _gap, _by, _bw, _bh, "Cancel")) {
        instance_destroy();
    }
    if (ui_button(_bx_start + (_bw + _gap) * 2, _by, _bw, _bh, "Save")) {
        tree.target_style = selected_key;
        instance_destroy();
    }
};
