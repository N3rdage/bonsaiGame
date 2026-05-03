// obj_game_controller — Draw GUI event
// Always-visible HUD: current day + money. Top-right corner.
draw_set_halign(fa_right);
draw_set_valign(fa_top);
draw_set_color(c_white);
draw_text(display_get_gui_width() - 16, 16,
    "Day " + string(global.game_day) + "  |  $" + string(global.money));
draw_set_halign(fa_left);
