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

// Wire-mode UI state
show_wired_hotspots   = true;
show_unwired_hotspots = true;
pending_wire_removal  = -1;   // -1 = no modal; otherwise = branch_id awaiting confirm
// Trunk-wire direction is screen-relative ("left"/"right"/"up"/"down") and
// persists across clicks. The viewer translates it to a world XY angle at
// click time using cam_yaw, so "left" always means screen-left from the
// current camera angle. Player rotates camera, picks direction once, then
// clicks trunk hotspots to apply.
wire_trunk_dir = "left";

// For drag-to-rotate
dragging    = false;
prev_mx     = 0;
prev_my     = 0;

// Pre-warm the mesh so the first frame has it ready
mesh = tree.get_mesh();

// Disable the game controller's time advancement while in the viewer —
// the player is taking a timeless aesthetic moment with their tree.
global.game_paused = true;