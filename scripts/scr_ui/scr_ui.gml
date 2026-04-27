// scr_ui
// Small helpers for drawing and hit-testing buttons inside UI panels.
// Call these from a panel's Draw GUI event.

// Draw a button. Returns true if this button was clicked this frame.
// _x, _y are top-left in GUI coordinates.
function ui_button(_x, _y, _w, _h, _label, _enabled = true) {
    var _mx = device_mouse_x_to_gui(0);
    var _my = device_mouse_y_to_gui(0);
    var _hover = _enabled
              && _mx >= _x && _mx <= _x + _w
              && _my >= _y && _my <= _y + _h;

    // Background
    var _bg;
    if (!_enabled)   _bg = c_gray;
    else if (_hover) _bg = make_color_rgb(120, 150, 100);
    else             _bg = make_color_rgb(80, 110, 70);

    draw_set_color(_bg);
    draw_rectangle(_x, _y, _x + _w, _y + _h, false);
    draw_set_color(c_white);
    draw_rectangle(_x, _y, _x + _w, _y + _h, true);

    // Label
    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    draw_set_color(_enabled ? c_white : make_color_rgb(180, 180, 180));
    draw_text(_x + _w / 2, _y + _h / 2, _label);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    return _hover && _enabled && mouse_check_button_pressed(mb_left);
}

// Toggle button. Selected = filled like ui_button; deselected = outline only.
// Returns true on the click frame so the caller can flip its state.
function ui_toggle(_x, _y, _w, _h, _label, _selected, _enabled = true) {
    var _mx = device_mouse_x_to_gui(0);
    var _my = device_mouse_y_to_gui(0);
    var _hover = _enabled
              && _mx >= _x && _mx <= _x + _w
              && _my >= _y && _my <= _y + _h;

    if (_selected) {
        var _bg;
        if (!_enabled)   _bg = c_gray;
        else if (_hover) _bg = make_color_rgb(120, 150, 100);
        else             _bg = make_color_rgb(80, 110, 70);
        draw_set_color(_bg);
        draw_rectangle(_x, _y, _x + _w, _y + _h, false);
    } else if (_hover) {
        // Faint fill on hover to show the empty button is interactive
        draw_set_color(make_color_rgb(50, 70, 50));
        draw_rectangle(_x, _y, _x + _w, _y + _h, false);
    }

    draw_set_color(_enabled ? c_white : make_color_rgb(120, 120, 120));
    draw_rectangle(_x, _y, _x + _w, _y + _h, true);

    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    if (_selected) {
        draw_set_color(_enabled ? c_white : make_color_rgb(180, 180, 180));
    } else {
        draw_set_color(_enabled ? make_color_rgb(180, 200, 170) : make_color_rgb(120, 120, 120));
    }
    draw_text(_x + _w / 2, _y + _h / 2, _label);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    return _hover && _enabled && mouse_check_button_pressed(mb_left);
}

// Draw a horizontal value bar (e.g. health, water).
function ui_bar(_x, _y, _w, _h, _value, _max, _col) {
    var _pct = clamp(_value / _max, 0, 1);
    draw_set_color(make_color_rgb(40, 40, 40));
    draw_rectangle(_x, _y, _x + _w, _y + _h, false);
    draw_set_color(_col);
    draw_rectangle(_x, _y, _x + _w * _pct, _y + _h, false);
    draw_set_color(c_white);
    draw_rectangle(_x, _y, _x + _w, _y + _h, true);
}

// Draw a labeled stat row.
function ui_stat_row(_x, _y, _label, _value) {
    draw_set_color(make_color_rgb(200, 200, 200));
    draw_set_halign(fa_left);
    draw_text(_x, _y, _label);
    draw_set_color(c_white);
    draw_set_halign(fa_right);
    draw_text(_x + 300, _y, string(_value));
    draw_set_halign(fa_left);
}