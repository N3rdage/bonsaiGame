// obj_pedestal — Create event
event_inherited();

prompt = "Inspect Tree";

// Which tree does this pedestal display? Index into global.all_trees.
// Set via the room's instance creation code, or defaults to 0.
tree_index = 0;

on_interact = function() {
    if (array_length(global.all_trees) == 0) {
        show_debug_message("No trees to inspect.");
        return;
    }
    if (tree_index < 0 || tree_index >= array_length(global.all_trees)) {
        show_debug_message("tree_index out of range.");
        return;
    }
    
    // Spawn the inspector and hand it our tree
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_tree_inspector);
    _panel.tree = global.all_trees[tree_index];
};