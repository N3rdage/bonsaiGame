// obj_planting_table — Draw event
// Wooden table with a soil mound on one side and an empty pot on the other.
// Sprite is 32×32 centered.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 16, y + 12, x + 16, y + 17, false);
draw_set_alpha(1);

// Tabletop (lighter wood than workbench — sanded smoother)
draw_set_color(make_color_rgb(160, 110, 70));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, false);
draw_set_color(make_color_rgb(90, 60, 30));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, true);

// Legs
draw_set_color(make_color_rgb(80, 55, 25));
draw_rectangle(x - 14, y + 12, x - 10, y + 16, false);
draw_rectangle(x + 10, y + 12, x + 14, y + 16, false);

// Soil mound (left half)
draw_set_color(make_color_rgb(70, 50, 35));
draw_circle(x - 7, y, 5, false);
draw_set_color(make_color_rgb(45, 30, 20));
draw_circle(x - 7, y, 5, true);

// Pot (right half)
draw_set_color(make_color_rgb(150, 90, 55));
draw_rectangle(x + 3, y - 2, x + 13, y + 5, false);
draw_set_color(make_color_rgb(85, 50, 30));
draw_rectangle(x + 3, y - 2, x + 13, y + 5, true);
// Pot rim (lighter band at top)
draw_set_color(make_color_rgb(170, 105, 65));
draw_rectangle(x + 3, y - 2, x + 13, y, false);
