// obj_title — Draw GUI event

var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

// Any modal panel preempts the menu buttons (children of obj_ui_panel)
var _interactive = !instance_exists(obj_ui_panel);

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
var _stack_h = 5 * _bh + 4 * _gap;
var _by = (_gh - _stack_h) / 2 + 40;

if (ui_button(_bx, _by, _bw, _bh, "New Game", _interactive)) {
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_save_slots);
    _panel.mode = "new";
    _panel.panel_title = "New Game — Pick a Slot";
    _panel.on_select_slot = function(_slot) {
        global.active_slot       = _slot;
        global.pending_load_slot = 0;
        room_goto(rm_shed);
    };
}
_by += _bh + _gap;

var _continue_slot = most_recent_save_slot();
if (ui_button(_bx, _by, _bw, _bh, "Continue", _interactive && _continue_slot > 0)) {
    global.active_slot       = _continue_slot;
    global.pending_load_slot = _continue_slot;
    room_goto(rm_shed);
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Load Game", _interactive && _continue_slot > 0)) {
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_save_slots);
    _panel.mode = "load";
    _panel.panel_title = "Load Game";
    _panel.on_select_slot = function(_slot) {
        global.active_slot       = _slot;
        global.pending_load_slot = _slot;
        room_goto(rm_shed);
    };
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Settings", _interactive)) {
    instance_create_depth(0, 0, -1000, obj_ui_settings);
}
_by += _bh + _gap;

if (ui_button(_bx, _by, _bw, _bh, "Quit", _interactive)) {
    game_end();
}

draw_set_halign(fa_left);
draw_set_valign(fa_top);
