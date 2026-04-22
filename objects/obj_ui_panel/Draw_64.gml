// obj_ui_panel — Draw GUI event
// Draws the panel chrome. Subclasses add content by overriding draw_content.

// Dim the world behind the panel
draw_set_alpha(0.5);
draw_set_color(c_black);
draw_rectangle(0, 0, display_get_gui_width(), display_get_gui_height(), false);
draw_set_alpha(1);

// Panel background
draw_set_color(make_color_rgb(30, 35, 30));
draw_rectangle(panel_x, panel_y, panel_x + panel_w, panel_y + panel_h, false);
draw_set_color(make_color_rgb(140, 160, 120));
draw_rectangle(panel_x, panel_y, panel_x + panel_w, panel_y + panel_h, true);

// Title bar
draw_set_color(make_color_rgb(60, 80, 55));
draw_rectangle(panel_x, panel_y, panel_x + panel_w, panel_y + 32, false);
draw_set_color(c_white);
draw_set_halign(fa_left);
draw_set_valign(fa_middle);
draw_text(panel_x + 12, panel_y + 16, panel_title);

// Close hint
draw_set_halign(fa_right);
draw_set_color(make_color_rgb(180, 180, 180));
draw_text(panel_x + panel_w - 12, panel_y + 16, "[ESC] Close");
draw_set_halign(fa_left);
draw_set_valign(fa_top);

// Let the subclass draw its content
if (variable_instance_exists(id, "draw_content")) {
    draw_content();
}