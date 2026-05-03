// obj_wall — Draw event
// Vertical wood planks with a base shadow line so the wall reads as having
// depth instead of being a flat colour bar. Sprite is 32×32, top-left origin.

// Base wood
draw_set_color(make_color_rgb(120, 85, 55));
draw_rectangle(x, y, x + 32, y + 32, false);

// Plank divisions — darker grooves at 8/16/24
draw_set_color(make_color_rgb(80, 55, 30));
draw_line(x + 8,  y, x + 8,  y + 32);
draw_line(x + 16, y, x + 16, y + 32);
draw_line(x + 24, y, x + 24, y + 32);

// Plank-centre highlights — lighter grain stripe
draw_set_color(make_color_rgb(150, 110, 75));
draw_line(x + 4,  y, x + 4,  y + 32);
draw_line(x + 12, y, x + 12, y + 32);
draw_line(x + 20, y, x + 20, y + 32);
draw_line(x + 28, y, x + 28, y + 32);

// Base shadow line — gives the wall a sense of standing in front of the floor
draw_set_color(c_black);
draw_set_alpha(0.4);
draw_line(x, y + 31, x + 32, y + 31);
draw_set_alpha(1);
