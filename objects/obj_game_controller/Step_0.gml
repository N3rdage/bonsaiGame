// obj_game_controller — Step event

if (global.game_paused) exit;

global.time_accumulator += (delta_time / 1_000_000) * global.base_time_scale;

var _seconds_per_day = 300;
while (global.time_accumulator >= _seconds_per_day) {
    global.time_accumulator -= _seconds_per_day;
    advance_day_all_trees(1);
    show_debug_message("--- Day " + string(global.game_day) + " ---");
}

// Quicksave / quickload to the active slot (defaults to 1 if none set yet).
// F9 falls back to opening the slot picker when the active slot is empty,
// so the player can still get to a save without going back to the title.
if (keyboard_check_pressed(vk_f5)) {
    var _slot = (global.active_slot > 0) ? global.active_slot : 1;
    save_game(_slot);
    global.active_slot = _slot;
    show_debug_message("Saved to slot " + string(_slot) + ".");
}
if (keyboard_check_pressed(vk_f9)) {
    var _slot = (global.active_slot > 0) ? global.active_slot : 1;
    if (load_game(_slot)) {
        global.active_slot = _slot;
        show_debug_message("Loaded slot " + string(_slot) + ".");
    } else if (!instance_exists(obj_ui_panel)) {
        var _panel = instance_create_depth(0, 0, -1000, obj_ui_save_slots);
        _panel.mode = "load";
        _panel.panel_title = "Load Game";
        _panel.on_select_slot = function(_slot) {
            if (load_game(_slot)) {
                global.active_slot = _slot;
                show_debug_message("Loaded slot " + string(_slot) + ".");
            }
        };
    }
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

// F2: advance the world by 7 days. Ticks every tree, advances global.game_day,
// fires display revenue. Use this to test the full sim — F1 only skips tree 0.
if (keyboard_check_pressed(vk_f2)) {
    advance_day_all_trees(7);
    show_debug_message("World advanced 7 days. Day " + string(global.game_day));
}

// Inventory panel: I to toggle. Closes if already open; otherwise opens
// unless another modal panel is up.
if (keyboard_check_pressed(ord("I"))) {
    if (instance_exists(obj_ui_inventory)) {
        with (obj_ui_inventory) instance_destroy();
    } else if (!instance_exists(obj_ui_panel)) {
        instance_create_depth(0, 0, -1000, obj_ui_inventory);
    }
}

// Granny's notebook: J to toggle. Same gating as inventory.
if (keyboard_check_pressed(ord("J"))) {
    if (instance_exists(obj_ui_notebook)) {
        with (obj_ui_notebook) instance_destroy();
    } else if (!instance_exists(obj_ui_panel)) {
        instance_create_depth(0, 0, -1000, obj_ui_notebook);
    }
}