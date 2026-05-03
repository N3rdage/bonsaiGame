// obj_pedestal — Draw event
// Stone column with a slightly wider base and capital. The displayed-tree
// label sits below. Sprite is 32×32 centered.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.3);
draw_ellipse(x - 12, y + 14, x + 12, y + 17, false);
draw_set_alpha(1);

// Base (wider stone)
draw_set_color(make_color_rgb(140, 135, 130));
draw_rectangle(x - 10, y + 10, x + 10, y + 14, false);
draw_set_color(make_color_rgb(85, 82, 78));
draw_rectangle(x - 10, y + 10, x + 10, y + 14, true);

// Column shaft
draw_set_color(make_color_rgb(160, 155, 150));
draw_rectangle(x - 6, y - 12, x + 6, y + 10, false);
draw_set_color(make_color_rgb(90, 87, 82));
draw_rectangle(x - 6, y - 12, x + 6, y + 10, true);

// Top cap
draw_set_color(make_color_rgb(165, 160, 155));
draw_rectangle(x - 8, y - 14, x + 8, y - 10, false);
draw_set_color(make_color_rgb(95, 92, 88));
draw_rectangle(x - 8, y - 14, x + 8, y - 10, true);

// Displayed-tree label — empty state in grey, occupied state in white.
var _tree = get_displayed_tree();
var _label_y = y + sprite_height / 2 + 6;

draw_set_halign(fa_center);
draw_set_valign(fa_top);
if (_tree == undefined) {
    draw_set_color(make_color_rgb(150, 150, 150));
    draw_text(x, _label_y, "(empty)");
} else {
    draw_set_color(c_white);
    var _label = (_tree.name == "") ? _tree.get_species().display_name : _tree.name;
    draw_text(x, _label_y, _label);
}
draw_set_halign(fa_left);
draw_set_valign(fa_top);
