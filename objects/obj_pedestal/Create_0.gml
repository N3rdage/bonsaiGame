// obj_pedestal — Create event
// A display slot for a single tree. The tree it shows lives in
// global.all_trees with location = "displayed:" + pedestal_key, so save/load
// already roundtrips the relationship — pedestals don't need their own
// serialization. Set pedestal_key in the room editor's instance creation
// code (e.g. `pedestal_key = "shed_main";`) to give each pedestal a stable
// identity. An unconfigured pedestal logs and refuses to interact.
event_inherited();

prompt = "Use Pedestal";

// Set per-instance via Creation Code in the Room Editor.
pedestal_key = "";

// Resolve the displayed tree on demand. O(n) over global.all_trees, but
// n is small and this avoids any cache-staleness on save/load or place/remove.
get_displayed_tree = function() {
    if (pedestal_key == "") return undefined;
    var _target = "displayed:" + pedestal_key;
    for (var i = 0; i < array_length(global.all_trees); i++) {
        if (global.all_trees[i].location == _target) return global.all_trees[i];
    }
    return undefined;
};

on_interact = function() {
    if (pedestal_key == "") {
        show_debug_message("obj_pedestal: pedestal_key not set. Add `pedestal_key = \"...\";` to the instance creation code.");
        return;
    }
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_pedestal);
    _panel.pedestal = self;
};
