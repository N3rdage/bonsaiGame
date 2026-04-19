// obj_door — Create event
event_inherited();

// Configure these per-instance via Creation Code in the Room Editor
target_room = -1;
target_x    = 0;
target_y    = 0;
prompt      = "Enter";

on_interact = function() {
    if (target_room == -1) {
        show_debug_message("Door has no target_room set.");
        return;
    }
    global.pending_player_x = target_x;
    global.pending_player_y = target_y;
    room_goto(target_room);
};