// obj_tree_sprite — Draw event
// Bonsai silhouette: pot, trunk, leafy dome in the species's leaf colour.
// Sprite is 48×48 centered.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 16, y + 16, x + 16, y + 21, false);
draw_set_alpha(1);

if (tree_index >= 0 && tree_index < array_length(global.all_trees)) {
    var _t       = global.all_trees[tree_index];
    var _species = _t.get_species();

    // Pot body
    draw_set_color(make_color_rgb(150, 90, 55));
    draw_rectangle(x - 10, y + 8, x + 10, y + 18, false);
    draw_set_color(make_color_rgb(85, 50, 30));
    draw_rectangle(x - 10, y + 8, x + 10, y + 18, true);

    // Pot rim — lighter band along the top edge
    draw_set_color(make_color_rgb(170, 105, 65));
    draw_rectangle(x - 11, y + 7, x + 11, y + 10, false);
    draw_set_color(make_color_rgb(85, 50, 30));
    draw_rectangle(x - 11, y + 7, x + 11, y + 10, true);

    // Trunk
    draw_set_color(make_color_rgb(75, 50, 30));
    draw_rectangle(x - 2, y - 8, x + 2, y + 8, false);

    // Foliage — three overlapping circles in the species leaf colour
    draw_set_color(_species.leaf_color);
    draw_circle(x - 7, y - 8, 8, false);
    draw_circle(x + 6, y - 6, 8, false);
    draw_circle(x,     y - 14, 8, false);

    // Darker outline pass derived from the leaf colour
    var _lc = _species.leaf_color;
    var _r  = max(0, color_get_red(_lc)   - 50);
    var _g  = max(0, color_get_green(_lc) - 50);
    var _b  = max(0, color_get_blue(_lc)  - 50);
    draw_set_color(make_color_rgb(_r, _g, _b));
    draw_circle(x - 7, y - 8, 8, true);
    draw_circle(x + 6, y - 6, 8, true);
    draw_circle(x,     y - 14, 8, true);

    // Name label above
    draw_set_color(c_white);
    draw_set_halign(fa_center);
    draw_text(x, y - 32, _t.name);
    draw_set_halign(fa_left);
}
