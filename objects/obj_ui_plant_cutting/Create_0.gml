// obj_ui_plant_cutting — Create event
event_inherited();

panel_title = "Plant a Cutting";
panel_w     = 520;
panel_h     = 420;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

// Where in the world should the new tree sprite appear?
// Set by whoever opens this panel (e.g. the workbench).
spawn_room = -1;
spawn_x    = 0;
spawn_y    = 0;

selected_species = "";

draw_content = function() {
    var _x = panel_x + 20;
    var _y = panel_y + 50;
    var _line = 24;
    
    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    
    draw_text(_x, _y, "Available cuttings:");
    _y += _line + 8;
    
    // List each species that has cuttings available
    var _species_keys = struct_get_names(global.species);
    var _any_found = false;
    
    for (var i = 0; i < array_length(_species_keys); i++) {
        var _key = _species_keys[i];
        var _count = inventory_count("cutting_" + _key);
        if (_count <= 0) continue;
        _any_found = true;
        
        var _species = global.species[$ _key];
        var _selected = (selected_species == _key);
        
        // Row background (highlighted if selected)
        if (_selected) {
            draw_set_color(make_color_rgb(70, 100, 60));
            draw_rectangle(_x - 4, _y - 2, panel_x + panel_w - 20, _y + 24, false);
            draw_set_color(c_white);
        }
        draw_text(_x, _y, _species.display_name + "  x" + string(_count));
        
        if (ui_button(panel_x + panel_w - 120, _y - 4, 80, 28, _selected ? "Selected" : "Select")) {
            selected_species = _key;
        }
        _y += _line + 6;
    }
    
    if (!_any_found) {
        draw_set_color(make_color_rgb(200, 150, 150));
        draw_text(_x, _y, "No cuttings available.");
        _y += _line;
        draw_text(_x, _y, "Take some from plants in the garden.");
        _y += _line;
    }
    
    // Pot availability
    _y += 10;
    draw_set_color(c_white);
    var _pots = inventory_count("pot");
    draw_text(_x, _y, "Pots available: " + string(_pots));
    _y += _line;
    
    // Plant button
    var _bx = panel_x + (panel_w - 160) / 2;
    var _by = panel_y + panel_h - 70;
    var _can_plant = (selected_species != "") && (_pots > 0);
    
    if (ui_button(_bx, _by, 160, 44, "Plant Cutting", _can_plant)) {
        do_plant();
    }
    
    // Hint — sits clearly above the button so the button's outline doesn't
    // run into the text descenders.
    if (!_can_plant) {
        draw_set_color(make_color_rgb(150, 150, 150));
        draw_set_halign(fa_center);
        draw_text(panel_x + panel_w / 2, _by - 32,
            selected_species == "" ? "Select a cutting first." :
            (_pots <= 0 ? "You need a pot." : ""));
        draw_set_halign(fa_left);
    }
};

do_plant = function() {
    if (selected_species == "") return;
    if (!inventory_has("pot", 1)) return;
    if (!inventory_has("cutting_" + selected_species, 1)) return;
    
    inventory_remove("pot", 1);
    inventory_remove("cutting_" + selected_species, 1);
    
    // Create the tree
    var _tree = new BonsaiTree(selected_species, "cutting");
    _tree.name = "New " + global.species[$ selected_species].display_name;
    _tree.location = "inventory";   // until placed in world — set below
    array_push(global.all_trees, _tree);
    
    // Spawn a visible tree sprite in the world
    if (spawn_room != -1) {
        _tree.location = "shed";
        // Only spawn the sprite if we're currently in the target room
        if (room == spawn_room) {
            var _sprite = instance_create_layer(spawn_x, spawn_y, "Instances", obj_tree_sprite);
            _sprite.tree_index = array_length(global.all_trees) - 1;
        } else {
            // Will need to be spawned when the player enters spawn_room —
            // for now we just note it exists; a more complete system would
            // scan global.all_trees on room start and spawn sprites for
            // any trees whose location matches the room.
            show_debug_message("Tree planted but you're not in the spawn room.");
        }
    }
    
    show_debug_message("Planted a " + global.species[$ selected_species].display_name
        + ". Total trees: " + string(array_length(global.all_trees)));
    
    instance_destroy();   // close the panel
};