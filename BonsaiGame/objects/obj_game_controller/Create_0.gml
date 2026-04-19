// obj_game_controller — Create event

global.game_day         = 0;
global.money            = 100;
global.all_trees        = [];
global.next_tree_id     = 0;
global.game_paused      = false;
global.time_accumulator = 0;
global.base_time_scale  = 1.0;

init_species();
init_inventory();
init_vertex_format();

// Sample tree for testing
var _sample = new BonsaiTree("juniper", "seed");
_sample.name = "Starter";
_sample.add_branch(-1, 1.0, 30,  2.5);
_sample.add_branch(-1, 1.5, 210, 2.0);
_sample.add_branch(-1, 2.0, 120, 1.8);
array_push(global.all_trees, _sample);

show_debug_message("Game controller initialized. Day " + string(global.game_day));
show_debug_message("Inventory — Clay: " + string(inventory_count("clay"))
    + ", Pots: " + string(inventory_count("pot")));