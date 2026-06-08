// scr_settings
// Per-machine settings persisted to settings.json next to save files.
// Values that affect window/audio state, not game state. Game saves stay
// in their own slot files.

// Internal (logical) resolution. The game renders to a 960x540 view + GUI and
// is scaled up to the window (x2 = 1080p). All rooms are sized to this; all UI
// draws in GUI space (960x540), so window scale never affects layout. See
// ARCHITECTURE.md "Resolution".
#macro GAME_WIDTH  960
#macro GAME_HEIGHT 540

// Shed interior: the wall ring is inset well inside the 960x540 view so the shed
// reads as a cozy room rather than a warehouse. These are the wall-tile corner
// positions (top-left of the ring / bottom-right wall tile). Shared by the
// runtime wall ring (obj_game_controller Room Start) and the floor draw, so the
// floor tiles exactly the interior. Outside the ring shows the room background.
#macro SHED_X0 160
#macro SHED_Y0 96
#macro SHED_X1 768
#macro SHED_Y1 416

function init_settings() {
    global.settings = {
        fullscreen: false,
        scale:      2,    // window = GAME_WIDTH*scale x GAME_HEIGHT*scale when windowed
    };
}

function load_settings() {
    if (!file_exists("settings.json")) return false;
    var _buff = buffer_load("settings.json");
    var _json = buffer_read(_buff, buffer_string);
    buffer_delete(_buff);

    var _data = json_parse(_json);
    var _keys = struct_get_names(_data);
    for (var i = 0; i < array_length(_keys); i++) {
        global.settings[$ _keys[i]] = _data[$ _keys[i]];
    }
    return true;
}

function save_settings() {
    var _json = json_stringify(global.settings);
    var _buff = buffer_create(string_byte_length(_json) + 1, buffer_fixed, 1);
    buffer_write(_buff, buffer_string, _json);
    buffer_save(_buff, "settings.json");
    buffer_delete(_buff);
}

// Apply current settings to the running window. Safe to call any time.
// The GUI size is the logical resolution and is independent of window size, so
// it's set unconditionally; the window is only resized when not fullscreen.
function apply_settings() {
    display_set_gui_size(GAME_WIDTH, GAME_HEIGHT);
    window_set_fullscreen(global.settings.fullscreen);
    if (!global.settings.fullscreen) {
        var _scale = max(1, global.settings.scale);
        var _w = GAME_WIDTH  * _scale;
        var _h = GAME_HEIGHT * _scale;

        // Never request a window larger than the usable desktop. Reserve room
        // for the title bar + taskbar (fractions, so it holds across DPI). The
        // window shrinks uniformly so it stays 16:9 -- e.g. a 2x/3x request on
        // a 1080-tall screen just fills the available height instead of running
        // off-screen behind the taskbar. Fullscreen stays the crisp full-size
        // option; option_windows_scale=0 (keep aspect) covers any leftover.
        var _fit = min(1, (display_get_width() * 0.98) / _w,
                          (display_get_height() * 0.90) / _h);
        _w = floor(_w * _fit);
        _h = floor(_h * _fit);

        window_set_size(_w, _h);
        window_center();
    }
}
