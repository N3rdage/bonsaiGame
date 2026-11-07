// obj_tree_sprite — Create event
event_inherited();

// Index into global.all_trees. Set by whoever spawns this instance.
tree_index = -1;
prompt = "Inspect";

on_interact = function() {
    if (tree_index < 0 || tree_index >= array_length(global.all_trees)) {
        show_debug_message("obj_tree_sprite: bad tree_index " + string(tree_index));
        return;
    }
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_inspector);
    _panel.tree = global.all_trees[tree_index];
};