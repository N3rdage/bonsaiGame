// obj_player_2d — Create event

move_speed = 2.5;   // tuned down for the ~48px player in the cozy interior
facing = "down";
interact_range = 40;
nearest_interactable = noone;

// Walk animation. spr_player is a 16-frame sheet (4 directions x 4 walk frames,
// frame = facing_row*4 + walk_index). We drive the frame manually, so disable
// auto-cycling; walk_anim is the 0..3 cycle position (0 = idle/contact pose).
image_speed = 0;
walk_anim   = 0;
