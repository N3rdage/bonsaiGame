// obj_viewer_3d — Draw GUI event

var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

// While the confirmation modal is open, all other UI is non-interactive.
var _interactive = (pending_wire_removal == -1);

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

// Wire-mode sub-row: action toggle, plus (in Bend mode only) direction picker
// and hotspot filters. Mental model is "what does a click do" + "in which
// direction" + "what to show." Remove mode collapses to just the action toggle
// since direction and unwired-filter are irrelevant when removing.
if (viewer_mode == "wire") {
    var _fty   = 64;
    var _fth   = 28;
    var _gap   = 8;
    var _label_w = 50;

    // Group A: action (always visible in wire mode)
    var _aw    = 80;
    var _g_a_w = _label_w + _gap + (_aw * 2 + _gap);

    // Groups B and C only in Bend mode
    var _show_bend_groups = (wire_action == "bend");
    var _dirs   = ["up", "left", "down", "right"];
    var _dir_lab = ["Up", "Left", "Down", "Right"];
    var _dw     = 56;
    var _g_b_w  = _label_w + _gap + (_dw * 4 + _gap * 3);
    var _ftw    = 92;
    var _g_c_w  = _label_w + _gap + (_ftw * 2 + _gap);

    var _sep    = 24;
    var _total  = _show_bend_groups ? (_g_a_w + _sep + _g_b_w + _sep + _g_c_w) : _g_a_w;
    var _row_x  = _gw / 2 - _total / 2;

    // Group A — Action
    draw_set_color(make_color_rgb(180, 180, 180));
    draw_set_halign(fa_right);
    draw_set_valign(fa_middle);
    draw_text(_row_x + _label_w, _fty + _fth / 2, "Action:");
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    var _ax0 = _row_x + _label_w + _gap;
    if (ui_toggle(_ax0, _fty, _aw, _fth, "Bend", wire_action == "bend", _interactive)) {
        wire_action = "bend";
    }
    if (ui_toggle(_ax0 + _aw + _gap, _fty, _aw, _fth, "Remove", wire_action == "remove", _interactive)) {
        wire_action = "remove";
    }

    if (_show_bend_groups) {
        // Group B — Bend direction
        var _bendx = _row_x + _g_a_w + _sep;
        draw_set_color(make_color_rgb(180, 180, 180));
        draw_set_halign(fa_right);
        draw_set_valign(fa_middle);
        draw_text(_bendx + _label_w, _fty + _fth / 2, "Bend:");
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        var _dir_x0 = _bendx + _label_w + _gap;
        for (var i = 0; i < 4; i++) {
            var _dir_bx = _dir_x0 + i * (_dw + _gap);
            if (ui_toggle(_dir_bx, _fty, _dw, _fth, _dir_lab[i], wire_bend_dir == _dirs[i], _interactive)) {
                wire_bend_dir = _dirs[i];
            }
        }

        // Group C — Show
        var _showx = _bendx + _g_b_w + _sep;
        draw_set_color(make_color_rgb(180, 180, 180));
        draw_set_halign(fa_right);
        draw_set_valign(fa_middle);
        draw_text(_showx + _label_w, _fty + _fth / 2, "Show:");
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        var _ftx = _showx + _label_w + _gap;
        if (ui_toggle(_ftx, _fty, _ftw, _fth, "Wired", show_wired_hotspots, _interactive)) {
            show_wired_hotspots = !show_wired_hotspots;
        }
        var _ftx2 = _ftx + _ftw + _gap;
        if (ui_toggle(_ftx2, _fty, _ftw, _fth, "Unwired", show_unwired_hotspots, _interactive)) {
            show_unwired_hotspots = !show_unwired_hotspots;
        }
    }
}

// Mode-specific UI — branch hotspots
if (viewer_mode == "clip" || viewer_mode == "prune" || viewer_mode == "wire") {
    _draw_branch_hotspots();
}
if (viewer_mode == "wire" && wire_action == "bend") {
    _draw_trunk_hotspots();
}

// Bottom help text
draw_set_color(make_color_rgb(180, 180, 180));
draw_set_halign(fa_center);
if (viewer_mode == "wire") {
    var _wire_stock = inventory_count("wire");
    var _wire_msg;
    if (wire_action == "bend") {
        _wire_msg = "Click branch or trunk to bend (" + string(BONSAI_BRANCH_BEND_PER_CLICK)
            + "° per click on branches, " + string(BONSAI_TRUNK_BEND_PER_EVENT)
            + "° on trunks)  |  Wire: " + string(_wire_stock);
    } else {
        _wire_msg = "Click a wired branch to remove its wire  |  Wire: " + string(_wire_stock);
    }
    if (_wire_stock <= 0) _wire_msg += "  (out)";
    draw_text(_gw / 2, _gh - 44, _wire_msg);
}
draw_text(_gw / 2, _gh - 24,
    "Drag to rotate  |  Scroll to zoom  |  R to reset camera");
draw_set_halign(fa_left);

// Confirmation modal — drawn last so it sits above everything else
if (pending_wire_removal >= 0) {
    _draw_wire_removal_modal();
}

function _draw_branch_hotspots() {
    var _ui_h = (viewer_mode == "wire") ? 110 : 60;
    var _modal_open = (pending_wire_removal >= 0);

    for (var i = 0; i < array_length(tree.branches); i++) {
        var _b = tree.branches[i];

        // Wire mode filters. In Remove action, force Wired-only — unwired
        // branches aren't a removal target so showing them would be noise.
        if (viewer_mode == "wire") {
            if (wire_action == "remove") {
                if (!_b.wired) continue;
            } else {
                if (_b.wired && !show_wired_hotspots) continue;
                if (!_b.wired && !show_unwired_hotspots) continue;
            }
        }

        var _mid = branch_point(tree, _b, 0.7);
        var _scr = project_3d_to_screen(_mid);
        if (_scr == undefined) continue;

        var _hover = point_distance(
            device_mouse_x_to_gui(0), device_mouse_y_to_gui(0),
            _scr.x, _scr.y) < 16;

        // Colour by mode + action: clip yellow, prune red. Wire mode splits
        // by wired state in Bend (blue = first wire, amber = add bend on
        // already-wired) and goes amber for everything in Remove.
        var _col;
        if (viewer_mode == "clip")       _col = make_color_rgb(255, 200, 80);
        else if (viewer_mode == "prune") _col = make_color_rgb(255, 100, 100);
        else if (wire_action == "remove") _col = make_color_rgb(255, 130, 40);
        else if (_b.wired)               _col = make_color_rgb(255, 180, 80);
        else                             _col = make_color_rgb(100, 200, 255);

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
                if (wire_action == "remove") {
                    if (_b.wired) pending_wire_removal = i;  // open confirm modal
                } else {
                    var _is_vertical = (wire_bend_dir == "up" || wire_bend_dir == "down");
                    var _axis = _is_vertical ? "v" : "h";
                    var _sign = _branch_bend_sign(tree, _b, wire_bend_dir, _axis);
                    var _delta = _sign * BONSAI_BRANCH_BEND_PER_CLICK;
                    var _cur_v = variable_struct_exists(_b, "bend_v") ? _b.bend_v : 0;
                    var _new_h = _is_vertical ? _b.bend  : (_b.bend + _delta);
                    var _new_v = _is_vertical ? (_cur_v + _delta) : _cur_v;
                    apply_wire(tree, i, _new_h, _new_v);
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
// applies a 20° bend at that height in the direction selected in the sub-row,
// consuming 1 wire. The trunk has no per-event "wired" state — movement is
// write-only history — so the Wired/Unwired filters only affect branches.
function _draw_trunk_hotspots() {
    var _ui_h = (viewer_mode == "wire") ? 110 : 60;
    var _modal_open = (pending_wire_removal >= 0);

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

        var _height_cm = _t * tree.trunk.height_cm;
        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);
        draw_text(_scr.x, _scr.y, string_format(_height_cm, 1, 0));
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        if (_hover && mouse_check_button_pressed(mb_left)
         && device_mouse_y_to_gui(0) > _ui_h
         && !_modal_open) {
            wire_trunk(tree, _height_cm, _trunk_bend_world_angle(wire_bend_dir, cam_yaw));
        }
    }
}

// Translate screen-relative bend direction to a world XY angle in degrees.
// Camera convention (Draw_72.gml): camera at (cos yaw * cos pitch, -sin yaw *
// cos pitch, sin pitch) * d, looking at the tree. Up/Down lie on the camera-
// radial axis. Left/Right would be world-perpendicular to that axis, but the
// project's z-up + (0,0,-1) lookat + negated aspect combo flips the screen-x
// handedness, so the L/R cases are inverted from the naive derivation.
// Independent of pitch — all bends stay horizontal in world.
// Pick the sign for a branch bend increment so the tip moves in the player's
// chosen screen direction. Numerical: perturb the branch's bend (in the named
// axis — "h" for horizontal sweep, "v" for vertical) by a small test delta,
// project the tip before-and-after to screen, and dot the screen-motion vector
// against the target screen direction. Positive dot → +bend moves the tip the
// right way; negative → flip the sign. Falls back to +1 when the branch is
// end-on to the camera (no usable screen motion).
function _branch_bend_sign(_tree, _branch, _dir, _axis) {
    var _scr_a = project_3d_to_screen(branch_point(_tree, _branch, 1));
    var _delta_test = 5;
    var _scr_b;
    if (_axis == "v") {
        var _orig_v = variable_struct_exists(_branch, "bend_v") ? _branch.bend_v : 0;
        _branch.bend_v = _orig_v + _delta_test;
        _scr_b = project_3d_to_screen(branch_point(_tree, _branch, 1));
        _branch.bend_v = _orig_v;
    } else {
        var _orig = _branch.bend;
        _branch.bend = _orig + _delta_test;
        _scr_b = project_3d_to_screen(branch_point(_tree, _branch, 1));
        _branch.bend = _orig;
    }
    if (_scr_a == undefined || _scr_b == undefined) return 1;

    var _dx = _scr_b.x - _scr_a.x;
    var _dy = _scr_b.y - _scr_a.y;
    var _tx = 0;
    var _ty = 0;
    switch (_dir) {
        case "right": _tx =  1; break;
        case "left":  _tx = -1; break;
        case "up":    _ty = -1; break;   // screen y grows downward
        case "down":  _ty =  1; break;
    }
    var _dot = _dx * _tx + _dy * _ty;
    return (_dot >= 0) ? 1 : -1;
}

function _trunk_bend_world_angle(_dir, _yaw) {
    switch (_dir) {
        case "right": return -90 - _yaw;
        case "left":  return  90 - _yaw;
        case "up":    return 180 - _yaw;   // away from camera
        case "down":  return       -_yaw;  // toward camera
    }
    return 0;
}