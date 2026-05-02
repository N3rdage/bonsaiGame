// obj_ui_tree_sell_confirm — Create event
// Modal confirmation for selling a tree. Spawned by obj_ui_tree_inspector's
// Sell button. Computes the sale price once on open (so the displayed number
// is what actually gets banked), then on Sell: marks the tree's location as
// "sold" (soft delete — preserves data for future Sale History) and removes
// any matching world sprite.
event_inherited();

panel_title = "Sell Tree";
panel_w     = 480;
panel_h     = 280;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

tree  = undefined;   // set by spawner immediately after instance_create_depth
score = undefined;   // captured on first draw
coins = 0;

draw_content = function() {
    if (tree == undefined) {
        draw_set_color(c_white);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_text(panel_x + 24, panel_y + 60, "No tree selected.");
        return;
    }

    if (score == undefined) {
        score = score_tree(tree);
        coins = round(score.total * 2);
    }

    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 26;

    var _species = tree.get_species();
    var _name    = (tree.name == "") ? "(unnamed)" : "\"" + tree.name + "\"";

    draw_set_color(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_text(_x, _y, "Sell " + _name + "?");
    _y += _line;

    draw_set_color(make_color_rgb(180, 180, 180));
    draw_text(_x, _y, "Species: " + _species.display_name);
    _y += _line;
    draw_text(_x, _y, "Score: " + string(score.total) + " / 100");
    _y += _line + 8;

    draw_set_color(make_color_rgb(220, 200, 120));
    draw_text(_x, _y, "Sale price: " + string(coins) + " coins");
    _y += _line;

    // Buttons
    var _bw = 120;
    var _bh = 36;
    var _gap = 24;
    var _by = panel_y + panel_h - _bh - 20;
    var _cx = panel_x + panel_w / 2;

    if (ui_button(_cx - _gap / 2 - _bw, _by, _bw, _bh, "Cancel")) {
        instance_destroy();
    }
    if (ui_button(_cx + _gap / 2, _by, _bw, _bh, "Sell")) {
        do_sell();
    }
};

do_sell = function() {
    if (tree == undefined) return;

    global.money += coins;

    var _sold_tree = tree;
    tree.location = "sold";
    // TODO: handle pot return when potting lands (tree.in_pot is currently
    // always undefined).

    // Remove the tree's visible sprite from the world. Iterating obj_tree_sprite
    // by struct identity avoids any tree_index reindexing concern.
    with (obj_tree_sprite) {
        if (global.all_trees[tree_index] == _sold_tree) {
            instance_destroy();
        }
    }

    show_debug_message("Sold tree for " + string(coins)
        + " coins. Money: " + string(global.money));

    instance_destroy();
};
