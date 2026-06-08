// obj_game_controller — Draw event
// Floor for the current room, drawn in code (not a tiled background layer, which
// would animate a multi-frame sprite). The controller's depth (set in Create)
// sits between the background colour (depth 100) and the instance layer (0), so
// the floor is over the background and under everything else. The shed floor
// fills only its inset interior; outside the walls the dark room background
// shows, framing the cozy room.

var _spr = -1;
var _fx0, _fy0, _fx1, _fy1;
if (room == rm_shed) {
    _spr = spr_floor_shed;
    _fx0 = SHED_X0 + 32; _fy0 = SHED_Y0 + 32; _fx1 = SHED_X1; _fy1 = SHED_Y1;
} else if (room == rm_garden_back) {
    _spr = spr_floor_garden;
    _fx0 = 0; _fy0 = 0; _fx1 = room_width; _fy1 = room_height;
}
if (_spr == -1) exit;   // 3D viewer / title etc.

var _tw = sprite_get_width(_spr);
var _th = sprite_get_height(_spr);
var _frames = sprite_get_number(_spr);

for (var _ty = _fy0; _ty < _fy1; _ty += _th) {
    for (var _tx = _fx0; _tx < _fx1; _tx += _tw) {
        // Stable per-tile frame (hash of tile coords) so variation scatters
        // without animating frame-to-frame.
        var _f = ((_tx div _tw) * 7 + (_ty div _th) * 13) mod _frames;
        draw_sprite(_spr, _f, _tx, _ty);
    }
}

// Shed: dim the floor a touch (cozy, less overbearing) + a central area rug so
// the room reads as lived-in rather than a bare plank expanse.
if (room == rm_shed) {
    draw_set_color(c_black);
    draw_set_alpha(0.12);
    draw_rectangle(_fx0, _fy0, _fx1, _fy1, false);
    draw_set_alpha(1);

    var _r1x = 360, _r1y = 220, _r2x = 600, _r2y = 360;
    draw_set_color(make_color_rgb(120, 72, 66));   // dusty red rug
    draw_roundrect(_r1x, _r1y, _r2x, _r2y, false);
    draw_set_color(make_color_rgb(85, 50, 46));
    draw_roundrect(_r1x, _r1y, _r2x, _r2y, true);
    draw_set_color(make_color_rgb(155, 110, 95));  // inset border
    draw_roundrect(_r1x + 7, _r1y + 7, _r2x - 7, _r2y - 7, true);
    draw_set_color(c_white);
}
