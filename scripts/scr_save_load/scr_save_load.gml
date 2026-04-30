// scr_save_load

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
            last_watered_day:_t.last_watered_day,
            last_fed_day:    _t.last_fed_day,
            location:        _t.location,
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
        game_day:     global.game_day,
        money:        global.money,
        inventory:    global.inventory,
        trees:        _tree_data,
        next_tree_id: global.next_tree_id,
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
    
    global.all_trees = [];
    for (var i = 0; i < array_length(_save.trees); i++) {
        var _data = _save.trees[i];
        var _t = new BonsaiTree(_data.species_key, _data.origin);
        var _keys = struct_get_names(_data);
        for (var k = 0; k < array_length(_keys); k++) {
            variable_struct_set(_t, _keys[k], _data[$ _keys[k]]);
        }
        _t.mesh_dirty = true;
        _t.mesh_cache = undefined;
        array_push(global.all_trees, _t);
    }
    
    return true;
}