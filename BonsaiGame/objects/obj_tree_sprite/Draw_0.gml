// obj_tree_sprite — Draw event
draw_self();

if (tree_index >= 0 && tree_index < array_length(global.all_trees)) {
    var _t = global.all_trees[tree_index];
    var _species = _t.get_species();
    
    // Tint a circle over the top portion of the sprite with species leaf colour
    draw_set_color(_species.leaf_color);
    draw_set_alpha(0.7);
    draw_circle(x, y - 10, 12, false);
    draw_set_alpha(1);
    draw_set_color(c_white);
    
    // Name label above
    draw_set_halign(fa_center);
    draw_set_color(c_white);
    draw_text(x, y - 36, _t.name);
    draw_set_halign(fa_left);
}