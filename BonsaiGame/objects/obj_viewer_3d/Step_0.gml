// obj_viewer_3d — Step event

// --- Mouse drag to rotate camera ---
var _mx = window_mouse_get_x();
var _my = window_mouse_get_y();

if (mouse_check_button_pressed(mb_left)) {
    // Only start dragging if click was NOT on the UI strip along the top
    // (simple rule: top 60 pixels reserved for toolbar)
    if (_my > 60) {
        dragging = true;
        prev_mx = _mx;
        prev_my = _my;
    }
}
if (mouse_check_button_released(mb_left)) {
    dragging = false;
}

if (dragging) {
    var _dx = _mx - prev_mx;
    var _dy = _my - prev_my;
    cam_yaw   -= _dx * 0.4;
    cam_pitch -= _dy * 0.4;
    cam_pitch = clamp(cam_pitch, -80, 80);
    prev_mx = _mx;
    prev_my = _my;
}

// --- Scroll wheel to zoom ---
if (mouse_wheel_up())   cam_distance -= 0.08;
if (mouse_wheel_down()) cam_distance += 0.08;
cam_distance = clamp(cam_distance, cam_zoom_min, cam_zoom_max);

// --- Adjust camera target to tree's current centre (trees grow) ---
cam_target.z = (tree.trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE * 0.5;

// --- Keyboard shortcuts ---
if (keyboard_check_pressed(ord("V"))) viewer_mode = "view";
if (keyboard_check_pressed(ord("W"))) viewer_mode = "wire";
if (keyboard_check_pressed(ord("C"))) viewer_mode = "clip";
if (keyboard_check_pressed(ord("P"))) viewer_mode = "prune";

// Reset camera
if (keyboard_check_pressed(ord("R"))) {
    cam_yaw = 45;
    cam_pitch = 20;
    cam_distance = 0.8;
}

// Exit
if (keyboard_check_pressed(vk_escape)) {
    global.game_paused = false;
    exit_3d_viewer();
}