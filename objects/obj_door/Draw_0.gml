// obj_door — Draw event
// Wooden door with a vertical plank join and a brass handle.
// Sprite is 32×32 with top-left origin: x,y is the top-left corner.
var _cx = x + 16;
var _cy = y + 16;

// Threshold shadow at the base
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(_cx - 14, _cy + 13, _cx + 14, _cy + 16, false);
draw_set_alpha(1);

// Frame (lighter trim around the door)
draw_set_color(make_color_rgb(95, 70, 45));
draw_rectangle(_cx - 14, _cy - 14, _cx + 14, _cy + 14, false);

// Door panel (darker wood)
draw_set_color(make_color_rgb(70, 45, 25));
draw_rectangle(_cx - 11, _cy - 11, _cx + 11, _cy + 12, false);
draw_set_color(make_color_rgb(40, 25, 15));
draw_rectangle(_cx - 11, _cy - 11, _cx + 11, _cy + 12, true);

// Vertical plank join down the middle
draw_set_color(make_color_rgb(40, 25, 15));
draw_line(_cx, _cy - 11, _cx, _cy + 12);

// Brass handle
draw_set_color(make_color_rgb(200, 160, 80));
draw_circle(_cx + 7, _cy + 2, 2, false);
draw_set_color(make_color_rgb(120, 90, 40));
draw_circle(_cx + 7, _cy + 2, 2, true);
