// obj_ui_notebook — Create event
// Granny's notebook: paginated reference covering each tutorial step. Pages
// follow tutorial_all_steps() in order; a final "all caught up" page appears
// once TUT_DONE. Locked pages (steps the player hasn't reached yet) hide
// flavour text to avoid spoilers — only the title shows. Toggle with J.
event_inherited();

panel_title = "Granny's Notebook";
panel_w     = 540;
panel_h     = 480;
panel_x = (display_get_gui_width()  - panel_w) / 2;
panel_y = (display_get_gui_height() - panel_h) / 2;

pages = tutorial_all_steps();
if (global.tutorial_step == TUT_DONE) {
    array_push(pages, TUT_DONE);   // finale page
}

// Open to the active step (or last page if everything is done) so the player
// lands on the most-relevant content rather than always page 1.
if (global.tutorial_step == TUT_DONE) {
    page_index = array_length(pages) - 1;
} else {
    page_index = 0;
    for (var i = 0; i < array_length(pages); i++) {
        if (pages[i] == global.tutorial_step) { page_index = i; break; }
    }
}

draw_content = function() {
    var _step = pages[page_index];
    var _x = panel_x + 28;
    var _y = panel_y + 56;
    var _line = 22;

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    // Page indicator
    draw_set_color(make_color_rgb(140, 140, 140));
    draw_text(panel_x + panel_w - 28 - string_width("Page " + string(page_index + 1)
        + " / " + string(array_length(pages))),
        _y, "Page " + string(page_index + 1) + " / " + string(array_length(pages)));

    // Page title — finale step gets a distinct heading
    draw_set_color(make_color_rgb(220, 220, 180));
    var _title = (_step == TUT_DONE) ? "All caught up" : tutorial_step_label(_step);
    draw_text(_x, _y, _title);
    _y += _line + 6;

    // Status badge — only for tutorial steps, not the finale
    if (_step != TUT_DONE) {
        var _status = tutorial_step_status(_step);
        var _badge_col;
        var _badge_text;
        if (_status == "completed") {
            _badge_col = make_color_rgb(140, 200, 120);
            _badge_text = "✓ done";
        } else if (_status == "active") {
            _badge_col = make_color_rgb(220, 200, 120);
            _badge_text = "in progress";
        } else {
            _badge_col = make_color_rgb(120, 120, 120);
            _badge_text = "not yet";
        }
        draw_set_color(_badge_col);
        draw_text(_x, _y, _badge_text);
        _y += _line + 8;

        // Locked pages hide flavour to avoid spoiling the next step.
        if (_status == "locked") {
            draw_set_color(make_color_rgb(120, 120, 120));
            draw_text_ext(_x, _y, "Granny left this page blank for now.", _line, panel_w - 56);
        } else {
            draw_set_color(c_white);
            draw_text_ext(_x, _y, tutorial_step_flavour(_step), _line, panel_w - 56);
            _y += string_height_ext(tutorial_step_flavour(_step), _line, panel_w - 56) + 12;

            draw_set_color(make_color_rgb(170, 200, 150));
            draw_text(_x, _y, "Quick prompt:");
            _y += _line;
            draw_set_color(make_color_rgb(220, 220, 220));
            draw_text_ext(_x + 12, _y, tutorial_step_body(_step), _line, panel_w - 80);
        }
    } else {
        _y += _line + 8;
        draw_set_color(c_white);
        draw_text_ext(_x, _y, tutorial_step_flavour(TUT_DONE), _line, panel_w - 56);
    }

    // Footer: Prev / Next / Close
    var _bw = 100;
    var _bh = 32;
    var _by = panel_y + panel_h - _bh - 18;

    var _can_prev = (page_index > 0);
    var _can_next = (page_index < array_length(pages) - 1);

    if (ui_button(panel_x + 24, _by, _bw, _bh, "< Prev", _can_prev)) {
        page_index = max(0, page_index - 1);
    }
    if (ui_button(panel_x + 24 + _bw + 12, _by, _bw, _bh, "Next >", _can_next)) {
        page_index = min(array_length(pages) - 1, page_index + 1);
    }
    if (ui_button(panel_x + panel_w - _bw - 24, _by, _bw, _bh, "Close")) {
        instance_destroy();
    }
};
