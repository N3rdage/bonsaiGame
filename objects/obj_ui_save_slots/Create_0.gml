// obj_ui_save_slots — Create event
// Modal slot picker. Two modes:
//   "load" — only occupied slots clickable; chosen slot fed to on_select_slot
//   "new"  — every slot clickable; occupied slots prompt overwrite-confirm
// The spawner sets `mode` and `on_select_slot(_slot)` before this becomes
// visible, so the panel itself is mode-agnostic plumbing.
event_inherited();

panel_w = 560;
panel_h = 440;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

mode           = "load";   // overridden by spawner
panel_title    = "Load Game";
on_select_slot = function(_slot) {};

// When >= 0, an overwrite-confirm sub-view replaces the slot list. Used in
// "new" mode when the player picks a slot that already has a save.
pending_overwrite_slot = -1;

draw_content = function() {
    if (pending_overwrite_slot >= 0) {
        draw_overwrite_confirm();
        return;
    }
    draw_slot_list();
};

draw_slot_list = function() {
    var _x = panel_x + 24;
    var _y = panel_y + 56;
    var _row_w = panel_w - 48;
    var _row_h = 80;
    var _row_gap = 8;

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    for (var i = 1; i <= SAVE_SLOT_COUNT; i++) {
        var _meta = save_slot_metadata(i);
        var _occupied = (_meta != undefined);

        // Row background
        draw_set_color(make_color_rgb(40, 50, 40));
        draw_rectangle(_x, _y, _x + _row_w, _y + _row_h, false);
        draw_set_color(make_color_rgb(140, 160, 120));
        draw_rectangle(_x, _y, _x + _row_w, _y + _row_h, true);

        draw_set_color(c_white);
        draw_text(_x + 16, _y + 12, "Slot " + string(i));

        draw_set_color(make_color_rgb(180, 180, 180));
        if (_occupied) {
            draw_text(_x + 16, _y + 40,
                "Day " + string(_meta.day)
                + "   $" + string(_meta.money)
                + "   saved " + _meta.saved_at);
        } else {
            draw_text(_x + 16, _y + 40, "(empty)");
        }

        var _can_use = (mode == "new") ? true : _occupied;
        var _btn_label = (mode == "new")
            ? (_occupied ? "Overwrite" : "Use")
            : "Load";
        if (ui_button(_x + _row_w - 124, _y + 22, 108, 36, _btn_label, _can_use)) {
            if (mode == "new" && _occupied) {
                pending_overwrite_slot = i;
            } else {
                on_select_slot(i);
                instance_destroy();
            }
        }

        _y += _row_h + _row_gap;
    }

    var _bw = 140;
    var _bh = 36;
    var _by = panel_y + panel_h - _bh - 20;
    var _bx = panel_x + (panel_w - _bw) / 2;
    if (ui_button(_bx, _by, _bw, _bh, "Cancel")) {
        on_close();
    }
};

draw_overwrite_confirm = function() {
    var _meta = save_slot_metadata(pending_overwrite_slot);
    var _x = panel_x + 24;
    var _y = panel_y + 64;
    var _line = 28;

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(c_white);
    draw_text(_x, _y, "Slot " + string(pending_overwrite_slot) + " already has a save:");
    _y += _line + 4;

    if (_meta != undefined) {
        draw_set_color(make_color_rgb(220, 200, 120));
        draw_text(_x + 16, _y,
            "Day " + string(_meta.day)
            + "   $" + string(_meta.money)
            + "   saved " + _meta.saved_at);
        _y += _line;
    }
    _y += _line;

    draw_set_color(make_color_rgb(220, 160, 160));
    draw_text(_x, _y, "Overwriting starts a new game and erases this save.");

    var _bw = 140;
    var _bh = 40;
    var _gap = 16;
    var _by = panel_y + panel_h - _bh - 20;
    var _total_w = _bw * 2 + _gap;
    var _bx_start = panel_x + (panel_w - _total_w) / 2;

    if (ui_button(_bx_start, _by, _bw, _bh, "Cancel")) {
        pending_overwrite_slot = -1;
    }
    if (ui_button(_bx_start + _bw + _gap, _by, _bw, _bh, "Overwrite")) {
        var _slot = pending_overwrite_slot;
        pending_overwrite_slot = -1;
        on_select_slot(_slot);
        instance_destroy();
    }
};
