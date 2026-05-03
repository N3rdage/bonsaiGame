// obj_source_plant — Draw event
// Wild bush in the garden — cuttings come from here. Three overlapping
// circles for an irregular silhouette so it doesn't read as one perfect dome.
// Sprite is 48×48 centered.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 18, y + 18, x + 18, y + 22, false);
draw_set_alpha(1);

// Trunk
draw_set_color(make_color_rgb(70, 45, 25));
draw_rectangle(x - 3, y, x + 3, y + 18, false);

// Foliage — three overlapping leafy lumps in slightly varied greens
draw_set_color(make_color_rgb(70, 110, 60));
draw_circle(x - 9, y - 4, 12, false);
draw_set_color(make_color_rgb(85, 130, 70));
draw_circle(x + 8, y - 6, 12, false);
draw_set_color(make_color_rgb(75, 120, 65));
draw_circle(x, y - 16, 11, false);

// Darker outline pass
draw_set_color(make_color_rgb(45, 75, 40));
draw_circle(x - 9, y - 4, 12, true);
draw_circle(x + 8, y - 6, 12, true);
draw_circle(x, y - 16, 11, true);
