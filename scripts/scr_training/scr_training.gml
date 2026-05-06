// scr_training

function apply_wire(_tree, _branch_id, _target_bend_deg) {
    if (_branch_id < 0 || _branch_id >= array_length(_tree.branches)) return false;
    if (!inventory_remove("wire", 1)) return false;

    var _branch = _tree.branches[_branch_id];
    _branch.wired = true;
    _branch.bend  = _target_bend_deg;
    
    array_push(_tree.wires_applied, {
        branch_id:   _branch_id,
        applied_day: global.game_day,
        removed_day: -1,
        bend_target: _target_bend_deg,
    });
    
    var _max_safe = 60 - (_branch.girth * 20);
    if (abs(_target_bend_deg) > _max_safe) {
        _tree.vitality -= 10;
    }
    
    _tree.mark_dirty();
    tutorial_advance_if(TUT_TRAIN);
    return true;
}

function remove_wire(_tree, _branch_id) {
    var _branch = _tree.branches[_branch_id];
    _branch.wired = false;
    for (var i = 0; i < array_length(_tree.wires_applied); i++) {
        var _w = _tree.wires_applied[i];
        if (_w.branch_id == _branch_id && _w.removed_day == -1) {
            _w.removed_day = global.game_day;
            var _duration = _w.removed_day - _w.applied_day;
            if (_duration < 56) {
                _branch.bend *= 0.3;
            }
            break;
        }
    }
    _tree.mark_dirty();
}

// Returns the currently-active wire entry for a branch, or undefined if none.
// "Active" = entry where removed_day is still -1.
function active_wire_for_branch(_tree, _branch_id) {
    for (var i = 0; i < array_length(_tree.wires_applied); i++) {
        var _w = _tree.wires_applied[i];
        if (_w.branch_id == _branch_id && _w.removed_day == -1) {
            return _w;
        }
    }
    return undefined;
}

function clip_branch(_tree, _branch_id, _amount_cm) {
    if (_branch_id < 0 || _branch_id >= array_length(_tree.branches)) return false;
    
    _tree.branches[_branch_id].length = max(1, _tree.branches[_branch_id].length - _amount_cm);
    _tree.foliage_density = max(0, _tree.foliage_density - 0.05);
    
    array_push(_tree.clips_history, {
        branch_id: _branch_id,
        day:       global.game_day,
        amount:    _amount_cm,
    });

    _tree.mark_dirty();
    tutorial_advance_if(TUT_TRAIN);
    return true;
}

function prune_branch(_tree, _branch_id) {
    if (_branch_id < 0 || _branch_id >= array_length(_tree.branches)) return false;
    
    array_delete(_tree.branches, _branch_id, 1);
    // Renumber surviving branches by position. Direct `.id =` assignment trips
    // GameMaker's GM1008 reserved-word check on structs (newer compilers); the
    // dynamic accessor sidesteps it.
    for (var i = 0; i < array_length(_tree.branches); i++) {
        variable_struct_set(_tree.branches[i], "id", i);
    }
    _tree.foliage_density = max(0, _tree.foliage_density - 0.1);
    
    array_push(_tree.prunes_history, {
        branch_id: _branch_id,
        day:       global.game_day,
    });

    _tree.mark_dirty();
    tutorial_advance_if(TUT_TRAIN);
    return true;
}

function wire_trunk(_tree, _height_cm, _angle_deg) {
    if (!inventory_remove("wire", 1)) return false;
    array_push(_tree.trunk.movement, {
        y: _height_cm,
        angle_deg: _angle_deg,
    });
    _tree.mark_dirty();
    tutorial_advance_if(TUT_TRAIN);
    return true;
}