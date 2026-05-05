// obj_title — Draw Begin event
// Mirrors obj_viewer_3d's setup: orbital camera, z-up world, perspective
// projection. The aspect is negated to compensate for GM's y-down screen.

var _cx = cam_target.x + dcos(cam_yaw) * dcos(cam_pitch) * cam_distance;
var _cy = cam_target.y - dsin(cam_yaw) * dcos(cam_pitch) * cam_distance;
var _cz = cam_target.z + dsin(cam_pitch) * cam_distance;

var _view = matrix_build_lookat(
    _cx, _cy, _cz,
    cam_target.x, cam_target.y, cam_target.z,
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
