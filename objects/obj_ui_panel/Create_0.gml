// obj_ui_panel — Create event
// Parent class for modal UI panels.

depth = -1000;   // draw on top of everything

// Subclasses override these
panel_title = "Panel";
panel_w     = 500;
panel_h     = 400;

// Auto-centre on screen
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

// Subclasses can override close behaviour
on_close = function() {
    instance_destroy();
};