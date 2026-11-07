// obj_player_2d — Room Start event
// Apply pending target position whenever a room loads.

if (variable_global_exists("pending_player_x") && global.pending_player_x != undefined) {
    x = global.pending_player_x;
    y = global.pending_player_y;
    global.pending_player_x = undefined;
    global.pending_player_y = undefined;
}