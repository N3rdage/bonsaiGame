// obj_title — Step event

// Settings panel preempts other input; clear the flag once it's gone
if (showing_settings) {
    if (instance_exists(obj_ui_settings)) exit;
    showing_settings = false;
}

// Slow rotation: ~5 degrees per second
cam_yaw += (delta_time / 1_000_000) * 5;
if (cam_yaw >= 360) cam_yaw -= 360;
