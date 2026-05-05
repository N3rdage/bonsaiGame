// obj_shop_kiosk — Draw event
// Wooden counter with a coin stack and a small "$" sign.
// Sprite is 32x32 centered: x,y is the centre.

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 16, y + 12, x + 16, y + 17, false);
draw_set_alpha(1);

// Counter top (mid wood)
draw_set_color(make_color_rgb(120, 80, 45));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, false);
draw_set_color(make_color_rgb(70, 45, 20));
draw_rectangle(x - 16, y - 4, x + 16, y + 12, true);

// Front-face plank suggestion
draw_set_color(make_color_rgb(95, 60, 30));
draw_line(x - 8, y - 4, x - 8, y + 12);
draw_line(x,     y - 4, x,     y + 12);
draw_line(x + 8, y - 4, x + 8, y + 12);

// Coin stack on the counter
draw_set_color(make_color_rgb(220, 180, 60));
draw_circle(x - 6, y - 3, 3, false);
draw_set_color(make_color_rgb(140, 110, 30));
draw_circle(x - 6, y - 3, 3, true);
draw_set_color(make_color_rgb(220, 180, 60));
draw_circle(x - 6, y - 6, 3, false);
draw_set_color(make_color_rgb(140, 110, 30));
draw_circle(x - 6, y - 6, 3, true);

// Sign on a post (right side)
draw_set_color(make_color_rgb(100, 70, 40));
draw_rectangle(x + 8, y - 14, x + 11, y - 4, false);
draw_set_color(make_color_rgb(220, 200, 140));
draw_rectangle(x + 6, y - 18, x + 14, y - 11, false);
draw_set_color(make_color_rgb(70, 45, 20));
draw_rectangle(x + 6, y - 18, x + 14, y - 11, true);
draw_set_halign(fa_center);
draw_set_valign(fa_middle);
draw_set_color(make_color_rgb(70, 45, 20));
draw_text(x + 10, y - 14, "$");
draw_set_halign(fa_left);
draw_set_valign(fa_top);
