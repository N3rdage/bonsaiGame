// obj_viewer_3d — Draw GUI event

var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

// While any modal is open, all other UI is non-interactive.
var _interactive = (pending_wire_removal == -1) && (pending_trunk_wire_y == -1);

// Top toolbar background — taller in wire mode to host the filter sub-row
var _toolbar_h = (viewer_mode == "wire") ? 110 : 60;
draw_set_color(make_color_rgb(25, 30, 25));
draw_set_alpha(0.85);
draw_rectangle(0, 0, _gw, _toolbar_h, false);
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
    if (ui_button(_bx + i * (_bw + 8), 12, _bw, _bh, _labels[i], _interactive)) {
        viewer_mode = _modes[i];
    }
}

// Exit button (top-right)
if (ui_button(_gw - 120, 12, 100, _bh, "Exit (Esc)", _interactive)) {
    global.game_paused = false;
    exit_3d_viewer();
}

// Wire-mode filter sub-row: toggle which hotspots show
if (viewer_mode == "wire") {
    var _ftw = 100, _fth = 28;
    var _ftgap = 8;
    var _fty = 64;
    var _ftx = _gw / 2 - (_ftw * 2 + _ftgap) / 2;

    // "Show:" label, right-aligned to the left of the buttons
    draw_set_color(make_color_rgb(180, 180, 180));
    draw_set_halign(fa_right);
    draw_set_valign(fa_middle);
    draw_text(_ftx - 12, _fty + _fth / 2, "Show:");
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    if (ui_toggle(_ftx, _fty, _ftw, _fth, "Wired", show_wired_hotspots, _interactive)) {
        show_wired_hotspots = !show_wired_hotspots;
    }

    var _ftx2 = _ftx + _ftw + _ftgap;
    if (ui_toggle(_ftx2, _fty, _ftw, _fth, "Unwired", show_unwired_hotspots, _interactive)) {
        show_unwired_hotspots = !show_unwired_hotspots;
    }
}

// Mode-specific UI — branch hotspots
if (viewer_mode == "clip" || viewer_mode == "prune" || viewer_mode == "wire") {
    _draw_branch_hotspots();
}
if (viewer_mode == "wire") {
    _draw_trunk_hotspots();
}

// Bottom help text
draw_set_color(make_color_rgb(180, 180, 180));
draw_set_halign(fa_center);
if (viewer_mode == "wire") {
    var _wire_stock = inventory_count("wire");
    var _wire_msg = "Click branch or trunk to wire  |  Click wired branch to remove"
        + "  |  Wire: " + string(_wire_stock);
    if (_wire_stock <= 0) _wire_msg += "  (out)";
    draw_text(_gw / 2, _gh - 44, _wire_msg);
}
draw_text(_gw / 2, _gh - 24,
    "Drag to rotate  |  Scroll to zoom  |  R to reset camera");
draw_set_halign(fa_left);

// Modals — drawn last so they sit above everything else
if (pending_wire_removal >= 0) {
    _draw_wire_removal_modal();
}
if (pending_trunk_wire_y >= 0) {
    _draw_trunk_wire_modal();
}

function _draw_branch_hotspots() {
    var _ui_h = (viewer_mode == "wire") ? 110 : 60;
    var _modal_open = (pending_wire_removal >= 0) || (pending_trunk_wire_y >= 0);

    for (var i = 0; i < array_length(tree.branches); i++) {
        var _b = tree.branches[i];

        // Wire mode: respect filter toggles
        if (viewer_mode == "wire") {
            if (_b.wired && !show_wired_hotspots) continue;
            if (!_b.wired && !show_unwired_hotspots) continue;
        }

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
            if (_age < 56) _caption += " (early)";
            draw_set_valign(fa_top);
            draw_text(_scr.x, _scr.y + _r + 4, _caption);
        }

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Click to perform action — suppressed while the modal is open
        if (_hover && mouse_check_button_pressed(mb_left)
         && device_mouse_y_to_gui(0) > _ui_h
         && !_modal_open) {
            if (viewer_mode == "clip") {
                clip_branch(tree, i, 1);
            } else if (viewer_mode == "prune") {
                prune_branch(tree, i);
                return;   // array changed, bail out of this frame's loop
            } else if (viewer_mode == "wire") {
                if (_b.wired) {
                    pending_wire_removal = i;   // open the confirm modal
                } else {
                    apply_wire(tree, i, 30);
                }
            }
        }
    }
}

function _draw_wire_removal_modal() {
    var _gw = display_get_gui_width();
    var _gh = display_get_gui_height();

    // Dim the background so the modal reads as foregrounded
    draw_set_color(c_black);
    draw_set_alpha(0.55);
    draw_rectangle(0, 0, _gw, _gh, false);
    draw_set_alpha(1);

    var _mw = 480, _mh = 200;
    var _mx = (_gw - _mw) / 2;
    var _my = (_gh - _mh) / 2;

    draw_set_color(make_color_rgb(40, 50, 40));
    draw_rectangle(_mx, _my, _mx + _mw, _my + _mh, false);
    draw_set_color(c_white);
    draw_rectangle(_mx, _my, _mx + _mw, _my + _mh, true);

    draw_set_halign(fa_center);
    draw_set_valign(fa_top);
    draw_text(_mx + _mw / 2, _my + 18,
        "Remove wire from branch " + string(pending_wire_removal) + "?");

    var _wire = active_wire_for_branch(tree, pending_wire_removal);
    var _age = (_wire == undefined) ? 0 : (global.game_day - _wire.applied_day);
    var _detail;
    if (_age < 56) {
        _detail = "Wire age: " + string(_age) + "d (early)\nBend will spring back to 30%.";
    } else {
        _detail = "Wire age: " + string(_age) + "d (permanent)\nBend will hold.";
    }
    draw_set_color(make_color_rgb(220, 220, 220));
    draw_text(_mx + _mw / 2, _my + 60, _detail);

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(c_white);

    var _bw = 120, _bh = 36;
    var _gap = 24;
    var _by = _my + _mh - _bh - 20;
    var _cx = _mx + _mw / 2;
    var _cancel_x = _cx - _gap / 2 - _bw;
    var _remove_x = _cx + _gap / 2;

    if (ui_button(_cancel_x, _by, _bw, _bh, "Cancel")) {
        pending_wire_removal = -1;
    }
    if (ui_button(_remove_x, _by, _bw, _bh, "Remove")) {
        remove_wire(tree, pending_wire_removal);
        pending_wire_removal = -1;
    }
}

// Trunk wiring hotspots: 4 evenly-spaced points up the trunk's curve. Click
// to open the direction picker. The trunk doesn't have a per-event "wired"
// state (movement events are write-only history), so these aren't filtered
// by the Wired/Unwired toggles — those apply only to branches.
function _draw_trunk_hotspots() {
    var _ui_h = (viewer_mode == "wire") ? 110 : 60;
    var _modal_open = (pending_wire_removal >= 0) || (pending_trunk_wire_y >= 0);

    // 4 hotspots at trunk-arc fractions 0.2 .. 0.8 (skip very base / tip)
    var _count = 4;
    var _t_lo  = 0.2;
    var _t_hi  = 0.8;

    for (var i = 0; i < _count; i++) {
        var _t = lerp(_t_lo, _t_hi, i / (_count - 1));
        var _f = trunk_frame_at(tree, _t);
        var _scr = project_3d_to_screen(_f.pos);
        if (_scr == undefined) continue;

        var _hover = point_distance(
            device_mouse_x_to_gui(0), device_mouse_y_to_gui(0),
            _scr.x, _scr.y) < 16;

        // Distinct hue from branch wire hotspots — green so the player reads
        // "this is a different kind of click target."
        var _col = make_color_rgb(120, 220, 140);
        var _r = _hover ? 12 : 8;
        draw_set_color(_col);
        draw_set_alpha(_hover ? 0.9 : 0.6);
        draw_circle(_scr.x, _scr.y, _r, false);
        draw_set_color(c_white);
        draw_set_alpha(1);
        draw_circle(_scr.x, _scr.y, _r, true);

        // Label as height in cm so the player knows what they're picking
        var _height_cm = _t * tree.trunk.height_cm;
        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);
        draw_text(_scr.x, _scr.y, string_format(_height_cm, 1, 0));
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        if (_hover && mouse_check_button_pressed(mb_left)
         && device_mouse_y_to_gui(0) > _ui_h
         && !_modal_open) {
            pending_trunk_wire_y = _height_cm;
        }
    }
}

// Direction picker for trunk wiring: 8 compass buttons in a 3x3 grid (centre
// holds the cancel button). Confirm calls wire_trunk(...) which consumes 1
// wire and pushes the bend onto trunk.movement.
function _draw_trunk_wire_modal() {
    var _gw = display_get_gui_width();
    var _gh = display_get_gui_height();

    draw_set_color(c_black);
    draw_set_alpha(0.55);
    draw_rectangle(0, 0, _gw, _gh, false);
    draw_set_alpha(1);

    var _mw = 360, _mh = 320;
    var _mx = (_gw - _mw) / 2;
    var _my = (_gh - _mh) / 2;

    draw_set_color(make_color_rgb(40, 50, 40));
    draw_rectangle(_mx, _my, _mx + _mw, _my + _mh, false);
    draw_set_color(c_white);
    draw_rectangle(_mx, _my, _mx + _mw, _my + _mh, true);

    draw_set_halign(fa_center);
    draw_set_valign(fa_top);
    draw_text(_mx + _mw / 2, _my + 16,
        "Bend trunk at " + string_format(pending_trunk_wire_y, 1, 0) + "cm");

    var _wire_stock = inventory_count("wire");
    draw_set_color(make_color_rgb(220, 220, 220));
    var _detail = "Pick a direction. Each click adds a "
        + string(BONSAI_TRUNK_BEND_PER_EVENT) + "° bend and uses 1 wire.";
    draw_text(_mx + _mw / 2, _my + 44, _detail);
    draw_text(_mx + _mw / 2, _my + 64, "Wire: " + string(_wire_stock)
        + (_wire_stock <= 0 ? "  (out)" : ""));
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(c_white);

    // 3x3 grid: 8 compass directions around a Cancel button. Angles use the
    // game's existing convention (0 = +x / east, 90 = +y / north).
    var _bw = 72, _bh = 48, _gap = 12;
    var _grid_w = _bw * 3 + _gap * 2;
    var _grid_x = _mx + (_mw - _grid_w) / 2;
    var _grid_y = _my + 100;

    var _labels = ["NW", "N",  "NE",
                   "W",  "X",  "E",
                   "SW", "S",  "SE"];
    var _angles = [135,  90,   45,
                   180,  -1,   0,
                   225,  270,  315];
    var _can_buy = (_wire_stock > 0);

    for (var i = 0; i < 9; i++) {
        var _col = i mod 3;
        var _row = i div 3;
        var _bx  = _grid_x + _col * (_bw + _gap);
        var _by  = _grid_y + _row * (_bh + _gap);

        if (_angles[i] == -1) {
            // Centre cell: Cancel
            if (ui_button(_bx, _by, _bw, _bh, "Cancel")) {
                pending_trunk_wire_y = -1;
            }
        } else {
            if (ui_button(_bx, _by, _bw, _bh, _labels[i], _can_buy)) {
                wire_trunk(tree, pending_trunk_wire_y, _angles[i]);
                pending_trunk_wire_y = -1;
            }
        }
    }
}