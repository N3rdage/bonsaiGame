// obj_wall — Draw event
// Shed walls use spr_wall. Garden fence: horizontal runs (top/bottom edges) use
// spr_fence; vertical runs (left/right edges) use spr_fence_v so they read as a
// fence rather than horizontal board-ends. All 32x32, top-left origin.
if (room == rm_garden_back) {
    var _vertical = (x <= 0 || x >= room_width - 32);
    draw_sprite(_vertical ? spr_fence_v : spr_fence, 0, x, y);
} else {
    draw_sprite(spr_wall, 0, x, y);
}
