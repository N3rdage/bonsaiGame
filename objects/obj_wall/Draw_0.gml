// obj_wall — Draw event
// Shed walls use spr_wall. Garden fence: horizontal runs (top/bottom edges) use
// spr_fence; vertical runs (left/right edges) use spr_fence_v so they read as a
// fence rather than horizontal board-ends. All 32x32, top-left origin.
if (room == rm_garden_back) {
    // Corner tiles (where a horizontal and a vertical run meet) are painted
    // procedurally in obj_game_controller's Draw End, where both rail sets join
    // around a post. Skip the flat sprite here so its rails don't dead-end into
    // the mismatched perpendicular run. (The instance still exists -> collision
    // is unaffected; only the draw is skipped.)
    var _corner = (x <= 0 || x >= room_width - 32) && (y <= 0 || y >= room_height - 32);
    if (_corner) exit;
    var _vertical = (x <= 0 || x >= room_width - 32);
    draw_sprite(_vertical ? spr_fence_v : spr_fence, 0, x, y);
} else {
    draw_sprite(spr_wall, 0, x, y);
}
