// obj_ui_tree_rename — Step event
event_inherited();   // parent handles ESC → on_close → instance_destroy

// Clamp typed input to the character limit
if (string_length(keyboard_string) > name_max_length) {
    keyboard_string = string_copy(keyboard_string, 1, name_max_length);
}

// Enter to save (only if a tree is wired up)
if (keyboard_check_pressed(vk_enter) && tree != undefined) {
    tree.name = keyboard_string;
    instance_destroy();
}
