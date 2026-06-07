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
        window_set_size(GAME_WIDTH * _scale, GAME_HEIGHT * _scale);
        window_center();
    }
}
