// scr_save_load

#macro SAVE_SLOT_COUNT 3

// "YYYY-MM-DD HH:MM" so lexicographic comparison sorts chronologically.
function _save_timestamp() {
    var _pad2 = function(_n) { return (_n < 10) ? "0" + string(_n) : string(_n); };
    return string(current_year) + "-" + _pad2(current_month) + "-" + _pad2(current_day)
        + " " + _pad2(current_hour) + ":" + _pad2(current_minute);
}

function save_game(_slot = 1) {
    var _tree_data = [];
    for (var i = 0; i < array_length(global.all_trees); i++) {
        var _t = global.all_trees[i];
        
        // Defensive: skip anything that isn't a proper BonsaiTree struct
        if (!is_struct(_t) || !variable_struct_exists(_t, "species_key")) {
            show_debug_message("save_game: skipping non-tree at index " + string(i));
            continue;
        }
        
        array_push(_tree_data, {
            id:              _t.id,
            species_key:     _t.species_key,
            origin:          _t.origin,
            name:            _t.name,
            age_days:        _t.age_days,
            vitality:        _t.vitality,
            vigor:           _t.vigor,
            water_level:     _t.water_level,
            last_watered_day:    _t.last_watered_day,
            last_fed_day:        _t.last_fed_day,
            fertilized_until_day:_t.fertilized_until_day,
            pot_tier:            _t.pot_tier,
            location:            _t.location,
            time_accel:      _t.time_accel,
            trunk:           _t.trunk,
            branches:        _t.branches,
            foliage_density: _t.foliage_density,
            wires_applied:   _t.wires_applied,
            clips_history:   _t.clips_history,
            prunes_history:  _t.prunes_history,
            repots_history:  _t.repots_history,
            style_tags:      _t.style_tags,
            target_style:    _t.target_style,
        });
    }
    
    var _save = {
        version:      1,
        saved_at:     _save_timestamp(),
        game_day:     global.game_day,
        money:        global.money,
        inventory:    global.inventory,
        trees:        _tree_data,
        next_tree_id: global.next_tree_id,
        tutorial_step: global.tutorial_step,
    };
    
    var _json = json_stringify(_save);
    var _buff = buffer_create(string_byte_length(_json) + 1, buffer_fixed, 1);
    buffer_write(_buff, buffer_string, _json);
    buffer_save(_buff, "save" + string(_slot) + ".json");
    buffer_delete(_buff);
    return true;
}

function load_game(_slot = 1) {
    var _fname = "save" + string(_slot) + ".json";
    if (!file_exists(_fname)) return false;
    
    var _buff = buffer_load(_fname);
    var _json = buffer_read(_buff, buffer_string);
    buffer_delete(_buff);
    
    var _save = json_parse(_json);
    
    global.game_day     = _save.game_day;
    global.money        = _save.money;
    global.inventory    = _save.inventory;
    global.next_tree_id = _save.next_tree_id;
    tutorial_init_for_load(_save);
    
    global.all_trees = [];
    for (var i = 0; i < array_length(_save.trees); i++) {
        var _data = _save.trees[i];
        var _t = new BonsaiTree(_data.species_key, _data.origin);
        var _keys = struct_get_names(_data);
        for (var k = 0; k < array_length(_keys); k++) {
            variable_struct_set(_t, _keys[k], _data[$ _keys[k]]);
        }
        // Branch field migration: pre-bend_v saves don't have the field.
        // Default to 0 so the mesh and viewer don't trip over a missing read.
        for (var b = 0; b < array_length(_t.branches); b++) {
            if (!variable_struct_exists(_t.branches[b], "bend_v")) {
                _t.branches[b].bend_v = 0;
            }
        }
        _t.mesh_dirty = true;
        _t.mesh_cache = undefined;
        array_push(global.all_trees, _t);
    }

    return true;
}

// Read just the header fields of a save file so the slot picker can show
// a preview without rehydrating trees. Returns undefined if no save exists.
function save_slot_metadata(_slot) {
    var _fname = "save" + string(_slot) + ".json";
    if (!file_exists(_fname)) return undefined;

    var _buff = buffer_load(_fname);
    var _json = buffer_read(_buff, buffer_string);
    buffer_delete(_buff);

    var _save = json_parse(_json);
    return {
        slot:     _slot,
        day:      _save.game_day,
        money:    _save.money,
        saved_at: variable_struct_exists(_save, "saved_at") ? _save.saved_at : "",
    };
}

// Returns the slot number with the most recent saved_at, or -1 if no saves.
// Lexicographic compare works on the "YYYY-MM-DD HH:MM" format. Pre-PR2
// saves have an empty saved_at — the `_best == -1` short-circuit makes them
// still count as discoverable; a slot with a real timestamp wins over them.
function most_recent_save_slot() {
    var _best = -1;
    var _best_at = "";
    for (var i = 1; i <= SAVE_SLOT_COUNT; i++) {
        var _meta = save_slot_metadata(i);
        if (_meta == undefined) continue;
        if (_best == -1 || _meta.saved_at > _best_at) {
            _best_at = _meta.saved_at;
            _best = i;
        }
    }
    return _best;
}