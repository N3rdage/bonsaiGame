// obj_viewer_3d — Draw GUI event

var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

// Top toolbar background
draw_set_color(make_color_rgb(25, 30, 25));
draw_set_alpha(0.85);
draw_rectangle(0, 0, _gw, 60, false);
draw_set_alpha(1);

// Tree info (top-left)
draw_set_color(c_white);
draw_set_halign(fa_left);
draw_set_valign(fa_top);
var _species = tree.get_species();
draw_text(16, 10, _species.display_name + (tree.name == "" ? "" : " \"" + tree.name + "\""));
draw_text(16, 32, "Age: " + string(tree.age_days) + "d  |  Height: "
    + string_format(tree.trunk.height_cm, 1, 1) + "cm  |  Branches: "
    + string(array_length(tree.branches)));

// Mode buttons (top-centre)
var _modes = ["view", "wire", "clip", "prune"];
var _labels = ["View (V)", "Wire (W)", "Clip (C)", "Prune (P)"];
var _bw = 100, _bh = 36;
var _bx = _gw / 2 - (_bw * 4 + 24) / 2;

for (var i = 0; i < 4; i++) {
    var _selected = (viewer_mode == _modes[i]);
    if (_selected) {
        draw_set_color(make_color_rgb(100, 140, 80));
        draw_rectangle(_bx + i * (_bw + 8) - 2, 12 - 2, _bx + i * (_bw + 8) + _bw + 2, 12 + _bh + 2, false);
    }
    if (ui_button(_bx + i * (_bw + 8), 12, _bw, _bh, _labels[i])) {
        viewer_mode = _modes[i];
    }
}

// Exit button (top-right)
if (ui_button(_gw - 120, 12, 100, _bh, "Exit (Esc)")) {
    global.game_paused = false;
    exit_3d_viewer();
}

// Mode-specific UI — branch hotspots
if (viewer_mode == "clip" || viewer_mode == "prune" || viewer_mode == "wire") {
    _draw_branch_hotspots();
}

// Bottom help text
draw_set_color(make_color_rgb(180, 180, 180));
draw_set_halign(fa_center);
if (viewer_mode == "wire") {
    draw_text(_gw / 2, _gh - 44,
        "Click branch to apply wire  |  Click wired branch to remove");
}
draw_text(_gw / 2, _gh - 24,
    "Drag to rotate  |  Scroll to zoom  |  R to reset camera");
draw_set_halign(fa_left);

function _draw_branch_hotspots() {
    for (var i = 0; i < array_length(tree.branches); i++) {
        var _b = tree.branches[i];
        var _mid = branch_point(tree, _b, 0.7);
        var _scr = project_3d_to_screen(_mid);
        if (_scr == undefined) continue;
        
        var _hover = point_distance(
            device_mouse_x_to_gui(0), device_mouse_y_to_gui(0),
            _scr.x, _scr.y) < 16;
        
        // Colour by mode (wire mode splits by wired state: blue = apply, amber = remove)
        var _col;
        if (viewer_mode == "clip")       _col = make_color_rgb(255, 200, 80);
        else if (viewer_mode == "prune") _col = make_color_rgb(255, 100, 100);
        else if (_b.wired)               _col = make_color_rgb(255, 130, 40);  // wire — remove
        else                             _col = make_color_rgb(100, 200, 255); // wire — apply

        var _r = _hover ? 12 : 8;
        draw_set_color(_col);
        draw_set_alpha(_hover ? 0.9 : 0.6);
        draw_circle(_scr.x, _scr.y, _r, false);
        draw_set_color(c_white);
        draw_set_alpha(1);
        draw_circle(_scr.x, _scr.y, _r, true);

        // Branch id label
        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);
        draw_text(_scr.x, _scr.y, string(i));

        // Wire-mode age caption beneath wired hotspots
        if (viewer_mode == "wire" && _b.wired) {
            var _wire = active_wire_for_branch(tree, i);
            var _age = (_wire == undefined) ? 0 : (global.game_day - _wire.applied_day);
            var _caption = string(_age) + "d";
            if (_age < 56) _caption += " — early";
            draw_set_valign(fa_top);
            draw_text(_scr.x, _scr.y + _r + 4, _caption);
        }

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Click to perform action
        if (_hover && mouse_check_button_pressed(mb_left)
         && device_mouse_y_to_gui(0) > 60) {
            if (viewer_mode == "clip") {
                clip_branch(tree, i, 1);
            } else if (viewer_mode == "prune") {
                prune_branch(tree, i);
                return;   // array changed, bail out of this frame's loop
            } else if (viewer_mode == "wire") {
                if (_b.wired) {
                    remove_wire(tree, i);
                } else {
                    apply_wire(tree, i, 30);
                }
            }
        }
    }
}