// obj_game_controller — Create event
// Runs the first time the controller is created in rm_shed (the controller
// is persistent, so subsequent room transitions don't re-fire this).
// Title screen sets global.pending_load_slot before room_goto(rm_shed):
//   0 (or absent) → fresh start, seed a starter juniper
//   N > 0         → load saveN.json instead of the starter

init_species();
init_styles();
init_inventory();
init_shop_catalogue();
init_vertex_format();

global.game_day         = 0;
global.money            = 100;
global.all_trees        = [];
global.next_tree_id     = 0;
global.game_paused      = false;
global.time_accumulator = 0;
global.base_time_scale  = 1.0;

// Title flow normally sets this before room_goto; default 0 = unsaved session
if (!variable_global_exists("active_slot")) global.active_slot = 0;

var _slot = variable_global_exists("pending_load_slot") ? global.pending_load_slot : 0;
if (_slot > 0) {
    if (!load_game(_slot)) {
        show_debug_message("Pending load slot " + string(_slot) + " missing; starting fresh.");
        _slot = 0;
    }
}
global.pending_load_slot = 0;

if (_slot == 0) {
    // New game: seed Granny's juniper as the player's inherited starting tree.
    // The tutorial (TUT_WATER → TUT_SKIP_WEEK → TUT_TRAIN) teaches care/training
    // on this tree before PR2 introduces the cutting/planting steps.
    var _sample = new BonsaiTree("juniper", "seed");
    // "Granny's" — short on purpose so it fits the inspector header without
    // clipping. The tutorial copy still calls it "Granny's juniper" for clarity.
    _sample.name = "Granny's";
    _sample.trunk.height_cm = 25;
    _sample.trunk.girth_mm  = 18;
    _sample.add_branch(-1, 8,  30,  12);
    _sample.add_branch(-1, 14, 210, 11);
    _sample.add_branch(-1, 18, 120, 10);
    _sample.add_branch(-1, 22, 60,   9);
    _sample.foliage_density = 0.5;
    _sample.location = "shed";
    array_push(global.all_trees, _sample);
    tutorial_init_for_new_game();
}
// (When _slot > 0, load_game already restored global.tutorial_step via
// tutorial_init_for_load — defaults to TUT_DONE for old saves.)

show_debug_message("Game controller initialized. Day " + string(global.game_day));
show_debug_message("Inventory — Clay: " + string(inventory_count("clay"))
    + ", Pots: " + string(inventory_count("pot")));