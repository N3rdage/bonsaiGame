// obj_game_controller — Create event

global.game_day         = 0;
global.money            = 100;
global.all_trees        = [];
global.next_tree_id     = 0;
global.game_paused      = false;
global.time_accumulator = 0;
global.base_time_scale  = 1.0;

init_species();
init_styles();
init_inventory();
init_vertex_format();

// Sample tree for testing
var _sample = new BonsaiTree("juniper", "seed");
_sample.name = "Starter";
_sample.trunk.height_cm = 25;
_sample.trunk.girth_mm  = 18;
_sample.add_branch(-1, 8,  30,  12);
_sample.add_branch(-1, 14, 210, 11);
_sample.add_branch(-1, 18, 120, 10);
_sample.add_branch(-1, 22, 60,   9);
_sample.foliage_density = 0.5;
_sample.location = "shed";
array_push(global.all_trees, _sample);

show_debug_message("Game controller initialized. Day " + string(global.game_day));
show_debug_message("Inventory — Clay: " + string(inventory_count("clay"))
    + ", Pots: " + string(inventory_count("pot")));