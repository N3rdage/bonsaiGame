// obj_ui_tree_repot_confirm — Create event
// Modal for choosing which pot tier to repot into. Spawned by the inspector's
// Repot button (which has already verified season + cooldown via repot_check).
// Two big tier buttons; each greyed if that inventory is empty. The action
// itself re-checks before mutating, so UI state can't lie.
event_inherited();

panel_title = "Repot Tree";
panel_w     = 520;
panel_h     = 320;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

tree = undefined;   // set by spawner immediately after instance_create_depth

draw_content = function() {
    if (tree == undefined) {
        draw_set_color(c_white);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_text(panel_x + 24, panel_y + 60, "No tree selected.");
        return;
    }

    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 26;

    var _species = tree.get_species();
    var _name    = (tree.name == "") ? "(unnamed)" : "\"" + tree.name + "\"";
    var _current = (tree.pot_tier == 1) ? "Fancy" : "Standard";
    var _days_since = global.game_day - tree.last_repot_day;

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "Repot " + _name + "?");
    _y += _line;

    draw_set_color(make_color_rgb(180, 180, 180));
    draw_text(_x, _y, "Species: " + _species.display_name);
    _y += _line;
    draw_text(_x, _y, "Current pot: " + _current);
    _y += _line;
    draw_text(_x, _y, "Vigor: " + string(floor(tree.vigor)) + " / 100 (resets to 50)");
    _y += _line;
    draw_text(_x, _y, "Days since last repot: " + string(_days_since));
    _y += _line + 12;

    var _have_std = inventory_count("pot");
    var _have_fcy = inventory_count("fancy_pot");

    // Pot-tier buttons. Two wide buttons side by side; player picks tier.
    var _bw = 200;
    var _bh = 44;
    var _gap = 16;
    var _by = panel_y + panel_h - _bh - 64;
    var _cx = panel_x + panel_w / 2;

    if (ui_button(_cx - _gap / 2 - _bw, _by, _bw, _bh,
                  "Standard Pot (owned: " + string(_have_std) + ")",
                  _have_std > 0)) {
        do_repot(0);
    }
    if (ui_button(_cx + _gap / 2, _by, _bw, _bh,
                  "Fancy Pot (owned: " + string(_have_fcy) + ")",
                  _have_fcy > 0)) {
        do_repot(1);
    }

    // Cancel button centred below
    var _cw = 120;
    var _ch = 36;
    var _cy = _by + _bh + 12;
    if (ui_button(_cx - _cw / 2, _cy, _cw, _ch, "Cancel")) {
        instance_destroy();
    }
};

do_repot = function(_tier) {
    if (tree == undefined) return;
    if (repot_tree(tree, _tier)) {
        show_debug_message("Repotted into "
            + ((_tier == 1) ? "fancy" : "standard") + " pot.");
    }
    instance_destroy();
};
