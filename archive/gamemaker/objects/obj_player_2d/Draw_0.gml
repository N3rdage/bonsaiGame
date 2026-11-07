// obj_player_2d — Draw event
// Animated character sprite. facing -> row, walk_anim -> frame within the row
// (frame = facing_row*4 + walk_index). spr_player is 32x32, centre origin.

var _row = 0;
switch (facing) {
    case "down":  _row = 0; break;
    case "up":    _row = 1; break;
    case "left":  _row = 2; break;
    case "right": _row = 3; break;
}

// Drop shadow — squashed ellipse on the ground
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 16, y + 9, x + 16, y + 18, false);
draw_set_alpha(1);

// 1.5x to match the prop/plant scale
draw_sprite_ext(spr_player, _row * 4 + floor(walk_anim), x, y, 1.5, 1.5, 0, c_white, 1);
