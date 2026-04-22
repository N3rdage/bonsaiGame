// scr_viewer
// Enter/exit helpers for the 3D viewer room.

function enter_3d_viewer(_tree) {
    global.viewer_target       = _tree;
    global.viewer_return_room  = room;
    global.viewer_return_x     = obj_player_2d.x;
    global.viewer_return_y     = obj_player_2d.y;
    room_goto(rm_viewer_3d);
}

function exit_3d_viewer() {
    global.pending_player_x = global.viewer_return_x;
    global.pending_player_y = global.viewer_return_y;
    room_goto(global.viewer_return_room);
}