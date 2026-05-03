// obj_workbench — Draw event
// Wooden table with a clay slab on top and a small mallet beside it.
// Sprite is 32×32 centered: x,y is the centre.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 16, y + 12, x + 16, y + 17, false);
draw_set_alpha(1);

// Tabletop (mid wood)
draw_set_color(make_color_rgb(140, 90, 50));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, false);
draw_set_color(make_color_rgb(80, 50, 25));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, true);

// Front legs peeking under the table
draw_set_color(make_color_rgb(70, 45, 20));
draw_rectangle(x - 14, y + 12, x - 10, y + 16, false);
draw_rectangle(x + 10, y + 12, x + 14, y + 16, false);

// Clay slab on top
draw_set_color(make_color_rgb(180, 110, 70));
draw_circle(x - 4, y, 5, false);
draw_set_color(make_color_rgb(110, 65, 35));
draw_circle(x - 4, y, 5, true);

// Mallet — handle + head
draw_set_color(make_color_rgb(120, 85, 50));
draw_rectangle(x + 3, y + 1, x + 13, y + 3, false);
draw_set_color(make_color_rgb(60, 40, 20));
draw_rectangle(x + 11, y - 2, x + 15, y + 6, false);
