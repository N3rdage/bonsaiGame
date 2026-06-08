// obj_player_2d — Step event
// Block movement and interaction while any UI panel is open
if (instance_exists(obj_ui_panel)) exit;

var _ix = keyboard_check(vk_right) - keyboard_check(vk_left);
var _iy = keyboard_check(vk_down)  - keyboard_check(vk_up);

// Also support WASD
_ix += keyboard_check(ord("D")) - keyboard_check(ord("A"));
_iy += keyboard_check(ord("S")) - keyboard_check(ord("W"));
_ix = clamp(_ix, -1, 1);
_iy = clamp(_iy, -1, 1);

// Normalize diagonals
var _len = point_distance(0, 0, _ix, _iy);
if (_len > 0) {
    _ix /= _len;
    _iy /= _len;
}

// Move with collision against walls
var _nx = x + _ix * move_speed;
var _ny = y + _iy * move_speed;
if (!place_meeting(_nx, y, obj_wall)) x = _nx;
if (!place_meeting(x, _ny, obj_wall)) y = _ny;

// Keep the player inside the room regardless of wall coverage (rooms aren't
// always fully enclosed yet). Room-space, so it tracks the 960x540 view.
x = clamp(x, 8, room_width  - 8);
y = clamp(y, 8, room_height - 8);

// Facing
if      (_ix >  0.5) facing = "right";
else if (_ix < -0.5) facing = "left";
else if (_iy >  0.5) facing = "down";
else if (_iy < -0.5) facing = "up";

// Walk animation — advance the 4-frame cycle while moving, idle (0) when still
if (_ix != 0 || _iy != 0) {
    walk_anim += 0.14;
    if (walk_anim >= 4) walk_anim -= 4;
} else {
    walk_anim = 0;
}

// Nearest interactable within range
nearest_interactable = instance_nearest(x, y, obj_interactable);
if (nearest_interactable != noone
&&  point_distance(x, y, nearest_interactable.x, nearest_interactable.y) > interact_range) {
    nearest_interactable = noone;
}

if (nearest_interactable != noone && keyboard_check_pressed(ord("E"))) {
    nearest_interactable.on_interact();
}

// Depth-sort by y so the player draws in front of walls/door/props (which sit
// at depth 0). Negative depth keeps the player above the floor (depth 50) too.
depth = -y;