// obj_viewer_3d — Create event

// Grab the tree we're viewing (set by enter_3d_viewer)
tree = global.viewer_target;

// Orbital camera state
cam_target   = { x: 0, y: 0, z: 0.5 };
cam_distance = 2.5;
cam_yaw      = 45;
cam_pitch    = 10;
cam_zoom_min = 0.8;
cam_zoom_max = 6.0;

// UI mode: "view" | "wire" | "clip" | "prune"
viewer_mode = "view";

// For drag-to-rotate
dragging    = false;
prev_mx     = 0;
prev_my     = 0;

// Pre-warm the mesh so the first frame has it ready
mesh = tree.get_mesh();

// Disable the game controller's time advancement while in the viewer —
// the player is taking a timeless aesthetic moment with their tree.
global.game_paused = true;