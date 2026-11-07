// obj_pedestal — Draw event
// Stone column with a slightly wider base and capital. The displayed-tree
// label sits below. Sprite is 32×32 centered.
draw_set_font(fnt_main);

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.3);
draw_ellipse(x - 18, y + 20, x + 18, y + 25, false);
draw_set_alpha(1);

// Stone display stand at 1.5x (~48px) to match the plant/tree scale
draw_sprite_ext(spr_pedestal, 0, x, y, 1.5, 1.5, 0, c_white, 1);

// Displayed-tree label — empty state in grey, occupied state in white.
var _tree = get_displayed_tree();
var _label_y = y + 30;

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
