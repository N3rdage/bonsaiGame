// obj_game_controller — Room Start event
// Respawn tree sprites for any trees "located" in this room.

// For now, only the shed/starting room hosts trees.
// When we add the greenhouse, we'll expand this check.
var _room_location = "";
if (room == rm_shed)  _room_location = "shed";
//if (room == rm_greenhouse) _room_location = "greenhouse";

if (_room_location == "") exit;

// Build an enclosed wall border at runtime. Replaces the ~130 hand-placed wall
// instances the shed used to carry (see DESIGN.md). obj_wall is non-persistent,
// so leaving/re-entering the room rebuilds it fresh — no accumulation. A gap on
// the bottom edge lines up with the garden door so it reads as a doorway.
var _tw     = 32;
var _gap_x1 = 448;   // doorway gap (the obj_door instance sits in here)
var _gap_x2 = 512;
for (var _wx = 0; _wx <= room_width - _tw; _wx += _tw) {
    instance_create_layer(_wx, 0, "Instances", obj_wall);              // top edge
    if (_wx < _gap_x1 || _wx >= _gap_x2) {
        instance_create_layer(_wx, room_height - _tw, "Instances", obj_wall);  // bottom edge (minus doorway)
    }
}
for (var _wy = _tw; _wy < room_height - _tw; _wy += _tw) {
    instance_create_layer(0, _wy, "Instances", obj_wall);             // left edge
    instance_create_layer(room_width - _tw, _wy, "Instances", obj_wall); // right edge
}

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