// obj_wall — Draw event
// Shed walls (spr_wall) / garden fence (spr_fence). Both 32x32, top-left origin;
// drawn at the instance position (the runtime border places these on the grid).
draw_sprite(room == rm_garden_back ? spr_fence : spr_wall, 0, x, y);
