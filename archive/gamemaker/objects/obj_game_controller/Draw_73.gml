// obj_game_controller — Draw End event
// Decor drawn AFTER the wall ring (Draw End runs after the normal Draw pass) so
// it sits in front of the walls. World-space coords.

if (room == rm_shed) {
    // Window set into the top wall band (bottom-centre origin -> sill sits low)
    draw_sprite(spr_window, 0, 560, SHED_Y0 + 28);
}
else if (room == rm_garden_back) {
    // Procedural mitred fence corners. obj_wall skips the 4 corner tiles (their
    // flat sprite would dead-end a run's rails into the perpendicular one), so we
    // mitre them here: each of the two rails turns the corner as an L, so both
    // the horizontal and the vertical run connect seamlessly with no covering
    // post.
    //
    // IMPORTANT: draw_rectangle(x0,y0,x1,y1) fills the region [x0,x1) x [y0,y1)
    // -- the far edge is EXCLUSIVE, so a 3px rail spanning pixel rows y..y+2
    // needs y1 = y+3, and a leg must reach x1 = 32 to cover pixel 31 and meet
    // the neighbouring run at pixel 32. Rail pixels match the sprites: horizontal
    // rails at rows y=13-15 / 22-24 (spr_fence), vertical rails at cols x=12-14 /
    // 18-20 (spr_fence_v); light on the top/left edge, dark on the bottom/right.
    // Wood tones = the art palette's wood_mid / dark / light.
    var _mid   = make_color_rgb(120, 85, 55);
    var _dark  = make_color_rgb(70,  45, 25);
    var _light = make_color_rgb(160, 110, 70);

    // [tile_x, tile_y, h_dir, v_dir]; +1 = the connecting run lies toward higher
    // coords. Left corners: h_dir=+1 (horizontal run to the right). Top corners:
    // v_dir=+1 (vertical run below).
    var _corners = [
        [0,                0,                 1,  1],   // top-left
        [room_width - 32,  0,                -1,  1],   // top-right
        [0,                room_height - 32,  1, -1],   // bottom-left
        [room_width - 32,  room_height - 32, -1, -1],   // bottom-right
    ];

    for (var _i = 0; _i < 4; _i++) {
        var _tx   = _corners[_i][0], _ty = _corners[_i][1];
        var _left = (_corners[_i][2] > 0);   // horizontal run is to the right
        var _top  = (_corners[_i][3] > 0);   // vertical run is below

        // Outer rail hugs the outer edges; inner rail is the other one. Pairing
        // outer-h with outer-v (and inner-h with inner-v) makes two nested L's
        // that never cross.
        var _oh = _top  ? 13 : 22,  _ih = _top  ? 22 : 13;   // horizontal rail row
        var _ov = _left ? 12 : 18,  _iv = _left ? 18 : 12;   // vertical rail col

        for (var _k = 0; _k < 2; _k++) {
            var _ry = (_k == 0) ? _oh : _ih;   // this L's horizontal rail (top row)
            var _rx = (_k == 0) ? _ov : _iv;   // this L's vertical rail (left col)

            // Horizontal leg: joint -> horizontal-neighbour edge (reaches px 31).
            var _hx0 = _left ? _rx : 0;
            var _hx1 = _left ? 32  : _rx + 3;
            draw_set_color(_mid);
            draw_rectangle(_tx + _hx0, _ty + _ry,     _tx + _hx1, _ty + _ry + 3, false);
            draw_set_color(_light);
            draw_rectangle(_tx + _hx0, _ty + _ry,     _tx + _hx1, _ty + _ry + 1, false);
            draw_set_color(_dark);
            draw_rectangle(_tx + _hx0, _ty + _ry + 2, _tx + _hx1, _ty + _ry + 3, false);

            // Vertical leg: joint -> vertical-neighbour edge (reaches px 31).
            var _vy0 = _top ? _ry : 0;
            var _vy1 = _top ? 32  : _ry + 3;
            draw_set_color(_mid);
            draw_rectangle(_tx + _rx,     _ty + _vy0, _tx + _rx + 3, _ty + _vy1, false);
            draw_set_color(_light);
            draw_rectangle(_tx + _rx,     _ty + _vy0, _tx + _rx + 1, _ty + _vy1, false);
            draw_set_color(_dark);
            draw_rectangle(_tx + _rx + 2, _ty + _vy0, _tx + _rx + 3, _ty + _vy1, false);
        }
    }
    draw_set_color(c_white);
}
