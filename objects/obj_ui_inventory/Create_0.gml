// obj_ui_inventory — Create event
// Read-only inventory panel: Resources, Seeds, Cuttings with counts.
// Items with count 0 are hidden; category headers always render so the
// player learns the categories exist.
event_inherited();

panel_title = "Inventory";
panel_w     = 500;
panel_h     = 460;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

resource_labels = {
    clay:        "Clay",
    pot:         "Pots",
    fancy_pot:   "Fancy Pots",
    wire:        "Wire",
    fertilizer:  "Fertilizer",
};

label_for_key = function(_key) {
    if (string_pos("seed_", _key) == 1) {
        var _sp = string_delete(_key, 1, 5);
        if (variable_struct_exists(global.species, _sp)) {
            return global.species[$ _sp].display_name;
        }
        return _sp;
    }
    if (string_pos("cutting_", _key) == 1) {
        var _sp = string_delete(_key, 1, 8);
        if (variable_struct_exists(global.species, _sp)) {
            return global.species[$ _sp].display_name;
        }
        return _sp;
    }
    if (variable_struct_exists(resource_labels, _key)) {
        return resource_labels[$ _key];
    }
    return _key;
};

draw_inventory_section = function(_x, _x_count, _y, _line, _title, _entries) {
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(make_color_rgb(140, 180, 120));
    draw_text(_x, _y, _title);
    _y += _line;

    if (array_length(_entries) == 0) {
        draw_set_color(make_color_rgb(140, 140, 140));
        draw_text(_x + 16, _y, "(none)");
        _y += _line;
        return _y;
    }

    draw_set_color(c_white);
    for (var i = 0; i < array_length(_entries); i++) {
        var _e = _entries[i];
        draw_set_halign(fa_left);
        draw_text(_x + 16, _y, _e.label);
        draw_set_halign(fa_right);
        draw_text(_x_count, _y, string(_e.count));
        _y += _line;
    }
    draw_set_halign(fa_left);
    return _y;
};

draw_content = function() {
    var _resources = [];
    var _seeds     = [];
    var _cuttings  = [];

    var _keys = struct_get_names(global.inventory);
    for (var i = 0; i < array_length(_keys); i++) {
        var _k = _keys[i];
        var _count = global.inventory[$ _k];
        if (_count <= 0) continue;

        var _entry = { label: label_for_key(_k), count: _count };
        if      (string_pos("seed_", _k) == 1)    array_push(_seeds, _entry);
        else if (string_pos("cutting_", _k) == 1) array_push(_cuttings, _entry);
        else                                      array_push(_resources, _entry);
    }

    var _x       = panel_x + 28;
    var _x_count = panel_x + panel_w - 28;
    var _y       = panel_y + 56;
    var _line    = 24;
    var _gap     = 16;

    _y = draw_inventory_section(_x, _x_count, _y, _line, "Resources", _resources);
    _y += _gap;
    _y = draw_inventory_section(_x, _x_count, _y, _line, "Seeds",     _seeds);
    _y += _gap;
    _y = draw_inventory_section(_x, _x_count, _y, _line, "Cuttings",  _cuttings);
};
