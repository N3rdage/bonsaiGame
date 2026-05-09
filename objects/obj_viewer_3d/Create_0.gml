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
// Bend direction is screen-relative ("left"/"right"/"up"/"down") and persists
// across clicks. Used for both trunk bends (translates to a world XY angle via
// cam_yaw) and branch bends (translates to a CCW/CW sign by perturbing the
// branch's tip and projecting to screen).
wire_bend_dir = "left";
// "bend" or "remove" — what clicks do in wire mode. Bend mode hotspot clicks
// add bend in wire_bend_dir; Remove mode opens the existing removal modal on
// wired branches and hides trunk hotspots (no per-event trunk removal yet).
wire_action = "bend";

// For drag-to-rotate
dragging    = false;
prev_mx     = 0;
prev_my     = 0;

// Pre-warm the mesh so the first frame has it ready
mesh = tree.get_mesh();

// Disable the game controller's time advancement while in the viewer —
// the player is taking a timeless aesthetic moment with their tree.
global.game_paused = true;