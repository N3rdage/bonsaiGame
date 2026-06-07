// obj_workbench — Create event
event_inherited();   // runs obj_interactable's Create event first

prompt = "Make Pot";
on_interact = function() {
    if (inventory_has("clay", 1)) {
        inventory_remove("clay", 1);
        inventory_add("pot", 1);
        show_toast("Made a pot  (" + string(inventory_count("pot")) + " pots, "
            + string(inventory_count("clay")) + " clay left)");
    } else {
        show_toast("Not enough clay to make a pot");
    }
};