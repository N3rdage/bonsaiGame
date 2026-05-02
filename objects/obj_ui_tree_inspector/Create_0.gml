// obj_ui_tree_inspector — Create event
event_inherited();

// Subclass overrides
panel_title = "Bonsai Inspector";
panel_w     = 600;
panel_h     = 640;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

// The tree we're inspecting — set by whoever spawns this panel
tree = undefined;

// Which branch is selected for clipping/pruning (UI selection only)
selected_branch = 0;

// Toggles the score breakdown view in place of the branch selector
show_breakdown = false;

// Override the draw_content function to render tree info + buttons.
draw_content = function() {
    if (tree == undefined) {
        draw_text(panel_x + 20, panel_y + 60, "No tree selected.");
        return;
    }
    
    var _species = tree.get_species();
    var _x = panel_x + 20;
    var _y = panel_y + 50;
    var _line = 22;
    
    // Stats section
    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "Species: " + _species.display_name);
    _y += _line;
    draw_text(_x, _y, "Origin: " + tree.origin);
    _y += _line;
    draw_text(_x, _y, "Age: " + string(tree.age_days) + " days");
    _y += _line;
    draw_text(_x, _y, "Trunk: " + string_format(tree.trunk.height_cm, 1, 1) + " cm tall, "
                                 + string_format(tree.trunk.girth_mm, 1, 1) + " mm thick");
    _y += _line;
    draw_text(_x, _y, "Branches: " + string(array_length(tree.branches)));
    _y += _line;

    var _style_label = "(none)";
    if (tree.target_style != "" && variable_struct_exists(global.styles, tree.target_style)) {
        _style_label = global.styles[$ tree.target_style].display_name;
    }
    draw_text(_x, _y, "Style: " + _style_label);
    _y += _line + 8;

    // Score
    var _score = score_tree(tree);
    draw_text(_x, _y, "Score: " + string(_score.total) + " / 100");
    if (ui_button(_x + 200, _y - 4, 140, 24, show_breakdown ? "Hide details" : "Show details")) {
        show_breakdown = !show_breakdown;
    }
    _y += _line + 8;

    // Bars
    draw_text(_x, _y, "Vitality");
    ui_bar(_x + 120, _y + 4, 200, 14, tree.vitality, 100, make_color_rgb(120, 200, 100));
    draw_text(_x + 330, _y, string(floor(tree.vitality)) + "/100");
    _y += _line;
    
    draw_text(_x, _y, "Water");
    ui_bar(_x + 120, _y + 4, 200, 14, tree.water_level, 100, make_color_rgb(100, 160, 220));
    draw_text(_x + 330, _y, string(floor(tree.water_level)) + "/100");
    _y += _line;
    
    draw_text(_x, _y, "Vigor");
    ui_bar(_x + 120, _y + 4, 200, 14, tree.vigor, 100, make_color_rgb(220, 180, 80));
    draw_text(_x + 330, _y, string(floor(tree.vigor)) + "/100");
    _y += _line + 16;
    
    var _branch_count = array_length(tree.branches);
    if (show_breakdown) {
        // Score breakdown: replaces the branch selector while toggled on.
        var _step = 22;
        var _by   = _y;
        for (var i = 0; i < array_length(_score.breakdown); i++) {
            var _c = _score.breakdown[i];
            draw_text(_x, _by, _c.label);
            if (_c.is_multiplier) {
                draw_text(_x + 260, _by, "x " + string_format(_c.value, 1, 2));
            } else {
                draw_text(_x + 260, _by, string_format(_c.points, 1, 1) + " pts");
            }
            _by += _step;
        }
        _y = _by + 8;
    } else if (_branch_count > 0) {
        draw_text(_x, _y, "Selected branch: " + string(selected_branch) + " / " + string(_branch_count - 1));
        if (ui_button(_x + 260, _y - 4, 40, 24, "<")) {
            selected_branch = (selected_branch - 1 + _branch_count) mod _branch_count;
        }
        if (ui_button(_x + 308, _y - 4, 40, 24, ">")) {
            selected_branch = (selected_branch + 1) mod _branch_count;
        }
        _y += _line;

        var _b = tree.branches[selected_branch];
        draw_text(_x + 20, _y, "Length: " + string_format(_b.length, 1, 1) + " cm | "
                              + "Angle: " + string(_b.angle) + "° | "
                              + "Bend: " + string(_b.bend) + "°"
                              + (_b.wired ? " | WIRED" : ""));
        _y += _line + 16;
    } else {
        draw_text(_x, _y, "No branches yet.");
        _y += _line;
    }
    
    // Action buttons
// Action buttons
    var _bx = panel_x + 20;
    var _bh = 36;
    var _gap = 10;
    var _footer_h = 28;
    // Two rows of buttons plus footer, working up from the panel bottom
    var _by = panel_y + panel_h - (_bh * 2 + _gap + _footer_h + 20);
    var _bw = 120;
    
    if (ui_button(_bx, _by, _bw, _bh, "Water")) {
        water_tree(tree);
    }
    
	var _skip_cost = max(1, ceil(7 * 0.5));   // mirrors the formula in scr_growth
	var _can_skip = inventory_has("fertilizer", _skip_cost);
	if (ui_button(_bx + (_bw + _gap), _by, _bw, _bh, "Skip 7d (" + string(_skip_cost) + "f)", _can_skip)) {
	    skip_tree_time(tree, 7);
	}
    
    var _has_branches = _branch_count > 0;
    if (ui_button(_bx + (_bw + _gap) * 2, _by, _bw, _bh, "Clip", _has_branches)) {
        clip_branch(tree, selected_branch, 1);
    }
    
    if (ui_button(_bx + (_bw + _gap) * 3, _by, _bw, _bh, "Prune", _has_branches)) {
        prune_branch(tree, selected_branch);
        if (selected_branch >= array_length(tree.branches)) {
            selected_branch = max(0, array_length(tree.branches) - 1);
        }
    }

	// Second row: mode buttons
    var _by2 = _by + _bh + _gap;

    if (ui_button(_bx, _by2, _bw, _bh, "Inspect 3D")) {
        // Close this panel first, then open the viewer
        instance_destroy();
        enter_3d_viewer(tree);
    }

    if (ui_button(_bx + (_bw + _gap), _by2, _bw, _bh, "Rename")) {
        // Hand off to the rename dialog; user re-inspects to see the new name
        var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_rename);
        _panel.tree = tree;
        instance_destroy();
    }

    if (ui_button(_bx + (_bw + _gap) * 2, _by2, _bw, _bh, "Set Style")) {
        var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_style_picker);
        _panel.tree = tree;
        instance_destroy();
    }

    if (ui_button(_bx + (_bw + _gap) * 3, _by2, _bw, _bh, "Sell")) {
        var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_sell_confirm);
        _panel.tree = tree;
        instance_destroy();
    }

    // Footer info (below the button rows)
    draw_set_color(make_color_rgb(150, 150, 150));
    draw_text(_bx, _by + (_bh + _gap) * 2 + 8,
        "Fertilizer: " + string(inventory_count("fertilizer"))
        + "  |  Day: " + string(global.game_day));
};