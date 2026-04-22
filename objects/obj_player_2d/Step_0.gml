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

// Facing
if      (_ix >  0.5) facing = "right";
else if (_ix < -0.5) facing = "left";
else if (_iy >  0.5) facing = "down";
else if (_iy < -0.5) facing = "up";

// Nearest interactable within range
nearest_interactable = instance_nearest(x, y, obj_interactable);
if (nearest_interactable != noone
&&  point_distance(x, y, nearest_interactable.x, nearest_interactable.y) > interact_range) {
    nearest_interactable = noone;
}

if (nearest_interactable != noone && keyboard_check_pressed(ord("E"))) {
    nearest_interactable.on_interact();
}