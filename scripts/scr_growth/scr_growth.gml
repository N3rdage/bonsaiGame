// scr_growth
// Daily tick logic for tree simulation.

function advance_day_all_trees(_days) {
    global.game_day += _days;
    for (var i = 0; i < array_length(global.all_trees); i++) {
        for (var d = 0; d < _days; d++) {
            tree_daily_tick(global.all_trees[i], false);
        }
    }

    // Display revenue: each tree on a pedestal pays score/10 coins per day.
    // Sell payout for the same tree is score*2, so display matches sell at
    // 20 days — the trade-off is patience vs instant cash.
    var _revenue = 0;
    for (var i = 0; i < array_length(global.all_trees); i++) {
        var _t = global.all_trees[i];
        if (string_pos("displayed:", _t.location) != 1) continue;
        var _score = score_tree(_t);
        _revenue += round(_score.total * 0.1) * _days;
    }
    if (_revenue > 0) {
        global.money += _revenue;
        show_debug_message("Display revenue: +" + string(_revenue)
            + " coins. Money: " + string(global.money));
    }
}

function tree_daily_tick(_tree, _isolated = false) {
    with (_tree) {
        var _species = get_species();
        age_days++;
        
        if (!_isolated) {
            water_level = max(0, water_level - _species.water_need * 5);
        }
        
        if (water_level < 10) vitality -= 2;
        else if (water_level > 90) vitality -= 1;
        else vitality = min(100, vitality + 0.3);
        vitality = clamp(vitality, 0, 100);
        
        var _growth_mult = (vitality / 100) * (vigor / 50) * _species.growth_rate;
        if (global.game_day < fertilized_until_day) _growth_mult *= 1.5;
        
        if (trunk.height_cm < _species.max_trunk_cm) {
            trunk.height_cm += 0.02 * _growth_mult;
        }
        trunk.girth_mm += 0.05 * _growth_mult;
        
        for (var i = 0; i < array_length(branches); i++) {
            branches[i].length += 0.1 * _growth_mult;
            branches[i].girth  += 0.01 * _growth_mult;
        }
        
		if (random(1) < 0.1 * _growth_mult && array_length(branches) < 15) {
		    _spawn_branch_naturally(self);
		}
        
        foliage_density = clamp(foliage_density + 0.01 * _growth_mult, 0, 1);
        mesh_dirty = true;
    }
}

function _spawn_branch_naturally(_tree) {
    var _count = array_length(_tree.branches);
    var _trunk_h = _tree.trunk.height_cm;
    
    var _target_t = 0.3 + (_count * 0.08) + random_range(-0.05, 0.05);
    _target_t = clamp(_target_t, 0.2, 0.95);
    var _y = _target_t * _trunk_h;
    
    var _base_angle = (_count mod 2 == 0) ? 0 : 180;
    if (_count > 2 && (_count mod 3 == 2)) _base_angle = 90;
    
    var _angle = _base_angle + random_range(-30, 30);
    var _length = random_range(2, 4);
    
    _tree.add_branch(-1, _y, _angle, _length);
}

function water_tree(_tree) {
    _tree.water_level = 100;
    _tree.last_watered_day = global.game_day;
}

// Consume 1 fertilizer and grant the tree a 7-day 1.5x growth window.
// Returns true on success, false if no fertilizer available.
function fertilize_tree(_tree) {
    if (!inventory_remove("fertilizer", 1)) return false;
    _tree.fertilized_until_day = global.game_day + 7;
    _tree.last_fed_day = global.game_day;
    return true;
}

function skip_tree_time(_tree, _days) {
    // Cost scales sub-linearly — bulk skips are efficient
    var _cost = max(1, ceil(_days * 0.5));
    if (!inventory_remove("fertilizer", _cost)) {
        return false;
    }
    for (var i = 0; i < _days; i++) {
        tree_daily_tick(_tree, true);
    }
    return true;
}