// obj_game_controller — Room Start event
// Respawn tree sprites for any trees "located" in this room.

// For now, only the shed/starting room hosts trees.
// When we add the greenhouse, we'll expand this check.
var _room_location = "";
if (room == rm_shed)  _room_location = "shed";
//if (room == rm_greenhouse) _room_location = "greenhouse";

if (_room_location == "") exit;

// Grid of positions to place sprites so they don't pile up on each other
var _spawn_x = 120;
var _spawn_y = 120;
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