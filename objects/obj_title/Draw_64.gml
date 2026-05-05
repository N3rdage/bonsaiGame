// obj_title — Draw GUI event

var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

// Buttons are non-interactive while the settings modal is open
var _interactive = !instance_exists(obj_ui_settings);

// Right column hosts the title text and the menu — tree is offset left
// in 3D so the right half of the frame is clear.
var _col_x = _gw * 0.72;

// Title text
draw_set_halign(fa_center);
draw_set_valign(fa_top);
draw_set_color(c_white);
draw_text(_col_x, 100, "Bonsai Greenhouse");
draw_set_color(make_color_rgb(160, 180, 150));
draw_text(_col_x, 140, "A cozy bonsai-growing sim");

// Vertical button stack, centered on the right column
var _bw = 240;
var _bh = 48;
var _gap = 12;
var _bx = _col_x - _bw / 2;
var _by = _gh / 2 - 30;

var _has_save = file_exists("save1.json");

if (ui_button(_bx, _by, _bw, _bh, "New Game", _interactive)) {
    global.pending_load_slot = 0;
    room_goto(rm_shed);
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Continue", _interactive && _has_save)) {
    global.pending_load_slot = 1;
    room_goto(rm_shed);
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Settings", _interactive)) {
    showing_settings = true;
    instance_create_depth(0, 0, -1000, obj_ui_settings);
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Quit", _interactive)) {
    game_end();
}

draw_set_halign(fa_left);
draw_set_valign(fa_top);
