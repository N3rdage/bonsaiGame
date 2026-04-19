// obj_interactable — Create event
// Parent class. Children override `prompt` and `on_interact`.

prompt = "Interact";
on_interact = function() {
    show_debug_message("Interacted with base interactable — override this.");
};