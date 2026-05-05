// obj_title — Draw Begin event
// Mirrors obj_viewer_3d's setup: orbital camera, z-up world, perspective
// projection. The aspect is negated to compensate for GM's y-down screen.

var _cx = cam_target.x + dcos(cam_yaw) * dcos(cam_pitch) * cam_distance;
var _cy = cam_target.y - dsin(cam_yaw) * dcos(cam_pitch) * cam_distance;
var _cz = cam_target.z + dsin(cam_pitch) * cam_distance;

// Apply lateral shift along the camera-right vector so the orbital geometry
// is preserved (tree stays put as the camera rotates) but the framing is
// offset — pushes the tree toward the left of the screen.
var _eye = vec3(_cx, _cy, _cz);
var _at  = vec3(cam_target.x, cam_target.y, cam_target.z);
var _up  = vec3(0, 0, -1);

var _fwd = vec3_normalize(vec3_sub(_at, _eye));
var _right = vec3_normalize(vec3_cross(_fwd, _up));

var _eye_s = vec3_add(_eye, vec3_scale(_right, lateral_shift));
var _at_s  = vec3_add(_at,  vec3_scale(_right, lateral_shift));

var _view = matrix_build_lookat(
    _eye_s.x, _eye_s.y, _eye_s.z,
    _at_s.x,  _at_s.y,  _at_s.z,
    0, 0, -1
);

var _aspect = window_get_width() / window_get_height();
var _proj = matrix_build_projection_perspective_fov(
    50,
    -_aspect,
    0.01, 20
);

camera_set_view_mat(view_camera[0], _view);
camera_set_proj_mat(view_camera[0], _proj);
camera_apply(view_camera[0]);

gpu_set_ztestenable(true);
gpu_set_zwriteenable(true);
gpu_set_cullmode(cull_noculling);

// Background — quiet forest green
draw_clear(make_color_rgb(28, 38, 32));
