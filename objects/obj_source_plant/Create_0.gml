// obj_source_plant — Create event
event_inherited();

// Set per-instance via Creation Code
species_key = "juniper";   // default
prompt = "Take Cutting";

// Cooldown so player can't spam-harvest
cuttings_taken = 0;
max_cuttings   = 3;
regrow_day     = -1;       // day when it'll offer cuttings again (-1 = ready now)

on_interact = function() {
    if (regrow_day > global.game_day) {
        show_debug_message("This plant is recovering. Ready on day " + string(regrow_day));
        return;
    }
    
    var _species = global.species[$ species_key];
    if (_species == undefined) {
        show_debug_message("Unknown species: " + species_key);
        return;
    }
    
    // Can this species be propagated by cutting?
    var _can_cutting = false;
    for (var i = 0; i < array_length(_species.propagation); i++) {
        if (_species.propagation[i] == "cutting") _can_cutting = true;
    }
    if (!_can_cutting) {
        show_debug_message(_species.display_name + " cannot be grown from cuttings. Try seeds.");
        return;
    }
    
    inventory_add("cutting_" + species_key, 1);
    tutorial_advance_if(TUT_TAKE_CUTTING);
    cuttings_taken++;
    show_debug_message("Took a " + _species.display_name + " cutting. Inventory: "
        + string(inventory_count("cutting_" + species_key)));
    
    if (cuttings_taken >= max_cuttings) {
        regrow_day = global.game_day + 14;   // 2 weeks to regrow
        cuttings_taken = 0;
        show_debug_message("Plant needs to recover.");
    }
};