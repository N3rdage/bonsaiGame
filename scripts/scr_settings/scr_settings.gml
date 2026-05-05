// scr_settings
// Per-machine settings persisted to settings.json next to save files.
// Values that affect window/audio state, not game state. Game saves stay
// in their own slot files.

function init_settings() {
    global.settings = {
        fullscreen: false,
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
function apply_settings() {
    window_set_fullscreen(global.settings.fullscreen);
}
