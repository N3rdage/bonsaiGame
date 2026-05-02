// obj_ui_pedestal — Create event
// Modal that handles a display pedestal's two states. Spawned by
// obj_pedestal.on_interact, with `pedestal` set to the pedestal instance.
//
//   Empty    → list trees with location == "shed", pick one, Place button.
//   Occupied → name + species, Inspect button (opens tree inspector) and
//              Remove button (sets tree.location back to "shed" and respawns
//              the world sprite at the pedestal's position).
event_inherited();

panel_title = "Display Pedestal";
panel_w     = 520;
panel_h     = 460;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

pedestal      = undefined;   // set by spawner
selected_tree = undefined;   // for the empty/place flow

draw_content = function() {
    if (pedestal == undefined) {
        draw_set_color(c_white);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_text(panel_x + 24, panel_y + 60, "No pedestal.");
        return;
    }

    var _displayed = pedestal.get_displayed_tree();
    if (_displayed != undefined) {
        draw_occupied(_displayed);
    } else {
        draw_empty();
    }
};

draw_occupied = function(_tree) {
    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 26;

    var _name    = (_tree.name == "") ? "(unnamed)" : "\"" + _tree.name + "\"";
    var _species = _tree.get_species();

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "Currently displayed:");
    _y += _line;

    draw_set_color(make_color_rgb(220, 200, 120));
    draw_text(_x, _y, _name);
    _y += _line;

    draw_set_color(make_color_rgb(180, 180, 180));
    draw_text(_x, _y, "Species: " + _species.display_name);
    _y += _line;
    draw_text(_x, _y, "Pedestal: " + pedestal.pedestal_key);

    var _bw = 140;
    var _bh = 36;
    var _gap = 16;
    var _by = panel_y + panel_h - _bh - 20;
    var _total_w = _bw * 2 + _gap;
    var _bx_start = panel_x + (panel_w - _total_w) / 2;

    if (ui_button(_bx_start, _by, _bw, _bh, "Inspect")) {
        var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_inspector);
        _panel.tree = _tree;
        instance_destroy();
    }
    if (ui_button(_bx_start + _bw + _gap, _by, _bw, _bh, "Remove")) {
        do_remove(_tree);
    }
};

draw_empty = function() {
    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 24;

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "This pedestal is empty. Choose a tree to display:");
    _y += _line + 8;

    var _row_w = panel_w - 48;
    var _row_h = 36;
    var _row_gap = 4;
    var _mx = device_mouse_x_to_gui(0);
    var _my = device_mouse_y_to_gui(0);

    var _any = false;
    for (var i = 0; i < array_length(global.all_trees); i++) {
        var _t = global.all_trees[i];
        if (_t.location != "shed") continue;
        _any = true;

        var _is_selected = (selected_tree == _t);
        var _hover = _mx >= _x && _mx <= _x + _row_w
                  && _my >= _y && _my <= _y + _row_h;

        if (_is_selected) {
            draw_set_color(make_color_rgb(70, 100, 60));
            draw_rectangle(_x, _y, _x + _row_w, _y + _row_h, false);
        } else if (_hover) {
            draw_set_color(make_color_rgb(45, 55, 45));
            draw_rectangle(_x, _y, _x + _row_w, _y + _row_h, false);
        }
        draw_set_color(make_color_rgb(140, 160, 120));
        draw_rectangle(_x, _y, _x + _row_w, _y + _row_h, true);

        draw_set_color(c_white);
        var _label = (_t.name == "") ? _t.get_species().display_name : _t.name;
        draw_text(_x + 12, _y + 8, _label);

        if (_hover && mouse_check_button_pressed(mb_left)) {
            selected_tree = _t;
        }

        _y += _row_h + _row_gap;
    }

    if (!_any) {
        draw_set_color(make_color_rgb(180, 150, 150));
        draw_text(_x, _y, "No trees available. Plant or grow some first.");
    }

    var _bw = 140;
    var _bh = 36;
    var _gap = 16;
    var _by = panel_y + panel_h - _bh - 20;
    var _total_w = _bw * 2 + _gap;
    var _bx_start = panel_x + (panel_w - _total_w) / 2;

    if (ui_button(_bx_start, _by, _bw, _bh, "Cancel")) {
        instance_destroy();
    }
    var _can_place = (selected_tree != undefined);
    if (ui_button(_bx_start + _bw + _gap, _by, _bw, _bh, "Place", _can_place)) {
        do_place();
    }
};

do_place = function() {
    if (selected_tree == undefined) return;
    if (pedestal == undefined || pedestal.pedestal_key == "") return;

    var _tree = selected_tree;
    _tree.location = "displayed:" + pedestal.pedestal_key;

    // Remove the world sprite for the just-placed tree.
    with (obj_tree_sprite) {
        if (global.all_trees[tree_index] == _tree) {
            instance_destroy();
        }
    }

    show_debug_message("Placed " + (_tree.name == "" ? "tree" : "\"" + _tree.name + "\"")
        + " on pedestal " + pedestal.pedestal_key);

    instance_destroy();
};

do_remove = function(_tree) {
    _tree.location = "shed";

    // If we're in the room where the tree's now homed, spawn a fresh world
    // sprite next to the pedestal. Otherwise the controller's Room Start
    // event will put it back in the grid on next entry.
    if (room == rm_shed) {
        var _idx = -1;
        for (var i = 0; i < array_length(global.all_trees); i++) {
            if (global.all_trees[i] == _tree) { _idx = i; break; }
        }
        if (_idx >= 0) {
            var _sprite = instance_create_layer(pedestal.x, pedestal.y + 48, "Instances", obj_tree_sprite);
            _sprite.tree_index = _idx;
        }
    }

    show_debug_message("Removed " + (_tree.name == "" ? "tree" : "\"" + _tree.name + "\"")
        + " from pedestal " + pedestal.pedestal_key);

    instance_destroy();
};
