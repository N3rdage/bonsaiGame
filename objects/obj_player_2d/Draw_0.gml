// obj_player_2d — Draw event
// Top-down humanoid drawn with primitives. The placeholder spr_player
// (32×32 red square) stays assigned for collision but is no longer drawn
// because this Draw event overrides the default sprite render.

var _fx = 0, _fy = 0;
switch (facing) {
    case "right": _fx =  1; break;
    case "left":  _fx = -1; break;
    case "down":  _fy =  1; break;
    case "up":    _fy = -1; break;
}

// Drop shadow — squashed ellipse on the ground
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 11, y + 6, x + 11, y + 12, false);
draw_set_alpha(1);

// Body (shirt)
draw_set_color(make_color_rgb(80, 110, 160));
draw_circle(x, y + 2, 10, false);
draw_set_color(make_color_rgb(40, 55, 80));
draw_circle(x, y + 2, 10, true);

// Head — sits above the body
draw_set_color(make_color_rgb(220, 180, 140));
draw_circle(x, y - 5, 7, false);
draw_set_color(make_color_rgb(150, 110, 80));
draw_circle(x, y - 5, 7, true);

// Hair — dark cap covering the rear of the head, offset opposite to facing
draw_set_color(make_color_rgb(70, 50, 35));
draw_circle(x - _fx * 2, y - 5 - _fy * 2 - 1, 5, false);

// Facing indicator — a small "nose" poking out in the facing direction.
// Hidden when facing up (we'd be looking at the back of the head).
if (facing != "up") {
    var _front_x = x + _fx * 6;
    var _front_y = y - 5 + _fy * 6;
    draw_set_color(make_color_rgb(180, 120, 80));
    draw_circle(_front_x, _front_y, 2, false);
}
