// obj_game_controller — Draw End event
// Decor drawn AFTER the wall ring (Draw End runs after the normal Draw pass) so
// it sits in front of the walls. World-space coords.

if (room == rm_shed) {
    // Window set into the top wall band (bottom-centre origin -> sill sits low)
    draw_sprite(spr_window, 0, 560, SHED_Y0 + 28);
}
else if (room == rm_garden_back) {
    // Corner posts cap the junction where the horizontal (spr_fence) and vertical
    // (spr_fence_v) runs meet, so the corners read as a fence's corner posts
    // instead of two mismatched board-ends. (Until a dedicated corner sprite.)
    var _cs = [[16, 16], [room_width - 16, 16],
               [16, room_height - 16], [room_width - 16, room_height - 16]];
    for (var _i = 0; _i < 4; _i++) {
        var _px = _cs[_i][0], _py = _cs[_i][1];
        draw_set_color(make_color_rgb(150, 100, 60));
        draw_roundrect(_px - 5, _py - 14, _px + 5, _py + 14, false);
        draw_set_color(make_color_rgb(90, 58, 30));
        draw_roundrect(_px - 5, _py - 14, _px + 5, _py + 14, true);
        draw_set_color(make_color_rgb(190, 135, 85));   // top cap highlight
        draw_rectangle(_px - 5, _py - 14, _px + 5, _py - 11, false);
    }
    draw_set_color(c_white);
}
