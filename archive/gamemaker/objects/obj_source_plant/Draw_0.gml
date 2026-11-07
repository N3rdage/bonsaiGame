// obj_source_plant — Draw event
// spr_source_plant, 48x48 centre origin; frame picks the species bush.
// (species_key is set by the instance creation code, which runs after Create,
// so resolve the frame here in Draw.)

// Drop shadow
draw_set_color(c_black);
draw_set_alpha(0.25);
draw_ellipse(x - 18, y + 18, x + 18, y + 22, false);
draw_set_alpha(1);

var _frame = 0;                       // 0 juniper
if (species_key == "maple") _frame = 1;
else if (species_key == "pine") _frame = 2;
draw_sprite(spr_source_plant, _frame, x, y);
