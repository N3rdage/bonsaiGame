// obj_title — Create event
// Initializes everything needed to render the hero tree on the title screen,
// loads per-machine settings, and seeds title-flow globals. Game state init
// (starter tree, fresh inventory) happens later when the player commits to
// New Game / Continue and obj_game_controller spins up in rm_shed.

init_species();
init_styles();
init_inventory();
init_shop_catalogue();
init_vertex_format();

init_settings();
load_settings();
apply_settings();

// BonsaiTree's constructor reads global.next_tree_id; the game controller
// resets it later but we need a value now for the hero tree's id field.
if (!variable_global_exists("next_tree_id")) global.next_tree_id = 0;

// Hero tree — built once, rendered every frame
hero_tree = build_title_hero_tree();
hero_mesh = hero_tree.get_mesh();

// Orbital camera (slow turntable around the tree)
cam_target   = { x: 0, y: 0, z: 0.7 };
cam_distance = 2.4;
cam_yaw      = 30;
cam_pitch    = 14;

// Marks whether a settings panel is currently up — gates other inputs
showing_settings = false;
