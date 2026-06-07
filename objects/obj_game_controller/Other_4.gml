// obj_game_controller — Room Start event
// Respawn tree sprites for any trees "located" in this room.

// Rooms the controller manages. Only the shed hosts placed trees for now.
var _room_location = "";
if (room == rm_shed)             _room_location = "shed";
else if (room == rm_garden_back) _room_location = "garden";
//if (room == rm_greenhouse) _room_location = "greenhouse";

if (_room_location == "") exit;

// Build an enclosed wall border at runtime. Replaces hand-placed obj_wall
// instances (see DESIGN.md). obj_wall is non-persistent, so leaving/re-entering
// rebuilds it fresh — no accumulation. Each room leaves a doorway gap that lines
// up with its obj_door: the shed's is on the bottom edge, the garden's (door
// back to the shed, where the player arrives) is on the left edge.
var _tw = 32;
for (var _wx = 0; _wx <= room_width - _tw; _wx += _tw) {
    instance_create_layer(_wx, 0, "Instances", obj_wall);                 // top edge
    // Bottom edge — gap in the shed for its doorway
    if (_room_location != "shed" || _wx < 448 || _wx >= 512) {
        instance_create_layer(_wx, room_height - _tw, "Instances", obj_wall);
    }
}
for (var _wy = _tw; _wy < room_height - _tw; _wy += _tw) {
    // Left edge — gap in the garden for its doorway
    if (_room_location != "garden" || _wy < 416 || _wy >= 480) {
        instance_create_layer(0, _wy, "Instances", obj_wall);
    }
    instance_create_layer(room_width - _tw, _wy, "Instances", obj_wall);  // right edge
}

// Tree sprites only live in the shed for now.
if (_room_location != "shed") exit;

// Grid of positions to place tree sprites in the open floor (clear of the work
// area top-left, the display pedestals top-right, and the doorway bottom-centre)
var _spawn_x = 300;
var _spawn_y = 380;
var _col = 0;
var _per_row = 6;

for (var i = 0; i < array_length(global.all_trees); i++) {
    var _t = global.all_trees[i];
    if (_t.location != _room_location) continue;
    
    var _sx = _spawn_x + (_col mod _per_row) * 64;
    var _sy = _spawn_y + floor(_col / _per_row) * 80;
    
    var _sprite = instance_create_layer(_sx, _sy, "Instances", obj_tree_sprite);
    _sprite.tree_index = i;
    _col++;
}