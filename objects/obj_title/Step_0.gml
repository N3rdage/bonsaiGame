// obj_title — Step event
// Slow rotation: ~5 degrees per second. Continues even when a modal is up
// so the title screen doesn't visually freeze.

cam_yaw += (delta_time / 1_000_000) * 5;
if (cam_yaw >= 360) cam_yaw -= 360;
