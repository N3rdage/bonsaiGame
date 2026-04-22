// obj_workbench — Create event
event_inherited();   // runs obj_interactable's Create event first

prompt = "Make Pot";
on_interact = function() {
    if (inventory_has("clay", 1)) {
        inventory_remove("clay", 1);
        inventory_add("pot", 1);
        show_debug_message("Made a pot. Pots: " + string(inventory_count("pot"))
            + ", Clay: " + string(inventory_count("clay")));
    } else {
        show_debug_message("Not enough clay.");
    }
};