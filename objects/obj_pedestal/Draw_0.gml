// obj_pedestal — Draw event
// Sprite plus a label below it: "(empty)" or the displayed tree's name.
draw_self();

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
