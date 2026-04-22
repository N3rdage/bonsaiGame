// obj_game_controller — Step event

if (global.game_paused) exit;

global.time_accumulator += (delta_time / 1_000_000) * global.base_time_scale;

var _seconds_per_day = 300;
while (global.time_accumulator >= _seconds_per_day) {
    global.time_accumulator -= _seconds_per_day;
    advance_day_all_trees(1);
    show_debug_message("--- Day " + string(global.game_day) + " ---");
}

// Debug keys
if (keyboard_check_pressed(vk_f5)) {
    save_game(1);
    show_debug_message("Saved.");
}
if (keyboard_check_pressed(vk_f9)) {
    if (load_game(1)) show_debug_message("Loaded.");
    else show_debug_message("No save found.");
}
if (keyboard_check_pressed(vk_f1) && array_length(global.all_trees) > 0) {
    if (skip_tree_time(global.all_trees[0], 7)) {
        var _t = global.all_trees[0];
        show_debug_message("Skipped 7 days. Tree age: " + string(_t.age_days)
            + " | Height: " + string(_t.trunk.height_cm)
            + " | Branches: " + string(array_length(_t.branches)));
    } else {
        show_debug_message("Not enough fertilizer to skip.");
    }
}