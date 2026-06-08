// obj_game_controller — Room Start event
// Respawn tree sprites for any trees "located" in this room.

// Rooms the controller manages. Only the shed hosts placed trees for now.
var _room_location = "";
if (room == rm_shed)             _room_location = "shed";
else if (room == rm_garden_back) _room_location = "garden";
//if (room == rm_greenhouse) _room_location = "greenhouse";

if (_room_location == "") exit;

// Build the enclosed wall ring at runtime (obj_wall is non-persistent, so it
// rebuilds fresh each entry). The shed is an INSET cozy interior — walls pulled
// well inside the 960x540 view so it reads as a small room, not a warehouse; the
// margin outside the walls shows the room's dark background. The garden fences
// the whole room. SHED_* are also read by the floor draw (Draw event).
var _tw = 32;
var _x0, _y0, _x1, _y1;
if (_room_location == "shed") {
    _x0 = SHED_X0; _y0 = SHED_Y0; _x1 = SHED_X1; _y1 = SHED_Y1;
} else {
    _x0 = 0; _y0 = 0; _x1 = room_width - _tw; _y1 = room_height - _tw;
}

// Top + bottom edges (solid; the shed door is drawn on top of the bottom wall)
for (var _wx = _x0; _wx <= _x1; _wx += _tw) {
    instance_create_layer(_wx, _y0, "Instances", obj_wall);
    instance_create_layer(_wx, _y1, "Instances", obj_wall);
}
// Left + right edges (garden leaves a doorway gap on the left)
for (var _wy = _y0 + _tw; _wy < _y1; _wy += _tw) {
    if (_room_location != "garden" || _wy < 416 || _wy >= 480) {
        instance_create_layer(_x0, _wy, "Instances", obj_wall);
    }
    instance_create_layer(_x1, _wy, "Instances", obj_wall);
}

// Tree sprites only live in the shed for now.
if (_room_location != "shed") exit;

// Grid of positions to place tree sprites in the open interior floor
var _spawn_x = 340;
var _spawn_y = 320;
var _col = 0;
var _per_row = 5;

for (var i = 0; i < array_length(global.all_trees); i++) {
    var _t = global.all_trees[i];
    if (_t.location != _room_location) continue;
    
    var _sx = _spawn_x + (_col mod _per_row) * 64;
    var _sy = _spawn_y + floor(_col / _per_row) * 80;
    
    var _sprite = instance_create_layer(_sx, _sy, "Instances", obj_tree_sprite);
    _sprite.tree_index = i;
    _col++;
}