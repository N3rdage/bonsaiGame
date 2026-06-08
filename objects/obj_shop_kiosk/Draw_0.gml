// obj_shop_kiosk — Draw event
// spr_shop_kiosk at 1.5x (~48px) to match the plant/tree scale.
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 22, y + 18, x + 22, y + 24, false);
draw_set_alpha(1);
draw_sprite_ext(spr_shop_kiosk, 0, x, y, 1.5, 1.5, 0, c_white, 1);
