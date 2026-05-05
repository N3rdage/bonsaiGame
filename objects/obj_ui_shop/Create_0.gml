// obj_ui_shop — Create event
// Modal shop panel. Lists global.shop_catalogue with name/price/owned/Buy
// per row, plus a money readout. Quantity per click is fixed at 1 — bulk buy
// can come later if needed.
event_inherited();

panel_title = "Shop";
panel_w     = 540;
panel_h     = 460;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

draw_content = function() {
    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _line = 28;

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    // Column headers
    draw_set_color(make_color_rgb(140, 180, 120));
    draw_text(_x,        _y, "Item");
    draw_text(_x + 220,  _y, "Price");
    draw_text(_x + 300,  _y, "Owned");
    _y += _line;

    // Catalogue rows
    draw_set_color(c_white);
    for (var i = 0; i < array_length(global.shop_catalogue); i++) {
        var _item = global.shop_catalogue[i];
        var _owned = inventory_count(_item.key);
        var _can_afford = (global.money >= _item.price);

        draw_text(_x,        _y + 6, _item.label);
        draw_text(_x + 220,  _y + 6, "$" + string(_item.price));
        draw_text(_x + 300,  _y + 6, string(_owned));

        if (ui_button(_x + 380, _y, 100, 28, "Buy", _can_afford)) {
            shop_buy(_item.key, 1, _item.price);
        }
        _y += _line + 6;
    }

    // Footer — current money
    draw_set_color(make_color_rgb(150, 150, 150));
    draw_text(_x, panel_y + panel_h - 36, "Money: $" + string(global.money));
};
