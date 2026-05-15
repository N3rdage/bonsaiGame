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
    // 20 days — the trade-off is patience vs instant cash. Fancy pots
    // (pot_tier == 1) bump the daily rate by 1.25x.
    var _revenue = 0;
    for (var i = 0; i < array_length(global.all_trees); i++) {
        var _t = global.all_trees[i];
        if (string_pos("displayed:", _t.location) != 1) continue;
        var _score = score_tree(_t);
        var _pot_mult = (_t.pot_tier == 1) ? 1.25 : 1.0;
        _revenue += round(_score.total * 0.1 * _pot_mult) * _days;
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
        var _season  = current_season();
        age_days++;

        if (!_isolated) {
            // Water pulls harder in summer, barely in winter (see scr_seasons).
            water_level = max(0, water_level - _species.water_need * 5 * season_water_multiplier(_season));
        }

        if (water_level < 10) vitality -= 2;
        else if (water_level > 90) vitality -= 1;
        else vitality = min(100, vitality + 0.3);
        vitality = clamp(vitality, 0, 100);

        // Season modulates growth: 0 = dormant (no morphology change this tick),
        // 1.3 spring boost, 1.0 summer baseline, 0.5 autumn, 0.4 winter-active.
        var _growth_mult = (vitality / 100) * (vigor / 50) * _species.growth_rate
                         * season_growth_multiplier(_species, _season);
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
// Returns true on success, false if no fertilizer available or if the tree's
// species is dormant this season (in which case fertilizer is NOT consumed —
// the player would just be wasting it). The inspector greys the button in
// this case so the player sees why; this is the belt-and-braces refusal.
function fertilize_tree(_tree) {
    var _species = _tree.get_species();
    if (season_growth_multiplier(_species, current_season()) <= 0) {
        show_debug_message("Tree is dormant this season; fertilizer skipped.");
        return false;
    }
    if (!inventory_remove("fertilizer", 1)) return false;
    _tree.fertilized_until_day = global.game_day + 7;
    _tree.last_fed_day = global.game_day;
    return true;
}

// Minimum days between repots — prevents free vigor resets and matches the
// real-bonsai practice of repotting every 2–3 years for mature trees.
#macro REPOT_COOLDOWN_DAYS 60

// Returns "ok" if the tree can be repotted right now, else a short reason
// string. The inspector uses this to render status callouts; the action
// itself re-checks before mutating so UI state can't lie.
function repot_check(_tree) {
    if (current_season() != "spring") return "out_of_season";
    if (global.game_day - _tree.last_repot_day < REPOT_COOLDOWN_DAYS) return "cooldown";
    return "ok";
}

// Consumes 1 pot of the chosen tier; refreshes vigor to baseline, stamps the
// repot day, appends to repots_history. Returns true on success. Caller
// (obj_ui_tree_repot_confirm) is expected to have already checked repot_check
// and the relevant inventory; this is a belt-and-braces gate so the action
// can't be smuggled past the UI.
function repot_tree(_tree, _new_tier) {
    if (repot_check(_tree) != "ok") return false;
    var _key = (_new_tier == 1) ? "fancy_pot" : "pot";
    if (!inventory_remove(_key, 1)) return false;

    _tree.pot_tier       = _new_tier;
    _tree.vigor          = 50;            // baseline reset; no full-100 boost
    _tree.last_repot_day = global.game_day;
    array_push(_tree.repots_history, { day: global.game_day, to_tier: _new_tier });
    _tree.mesh_dirty     = true;          // no visual delta yet, but future fancy-pot mesh will need it
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