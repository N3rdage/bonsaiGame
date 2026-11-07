// scr_seasons
// Season is a pure function of global.game_day — no persisted state. Year
// starts in spring on day 1; four BONSAI_DAYS_PER_SEASON-long seasons make
// one in-game year. Old saves Just Work because nothing is stored.

#macro BONSAI_DAYS_PER_SEASON 28

// "spring" | "summer" | "autumn" | "winter".
// Safe to call before obj_game_controller exists (title screen renders the
// hero tree before any game state is bootstrapped) — falls back to spring.
function current_season() {
    if (!variable_global_exists("game_day")) return "spring";
    var _d        = max(1, global.game_day);
    var _year_len = BONSAI_DAYS_PER_SEASON * 4;
    var _idx      = floor(((_d - 1) mod _year_len) / BONSAI_DAYS_PER_SEASON);
    switch (_idx) {
        case 0:  return "spring";
        case 1:  return "summer";
        case 2:  return "autumn";
        default: return "winter";
    }
}

// Day-of-season, 1..BONSAI_DAYS_PER_SEASON.
function current_season_day() {
    if (!variable_global_exists("game_day")) return 1;
    var _d = max(1, global.game_day);
    return ((_d - 1) mod BONSAI_DAYS_PER_SEASON) + 1;
}

function season_label(_key) {
    switch (_key) {
        case "spring": return "Spring";
        case "summer": return "Summer";
        case "autumn": return "Autumn";
        case "winter": return "Winter";
        default:       return "?";
    }
}

// Growth multiplier for a species in a given season. Returns 0 (dormant) when
// `_season` is not in `_species.seasons_active`. Otherwise: spring strongest,
// summer baseline, autumn slowing, winter only meaningful for winter-active
// species (pine). This is the single source of truth for "is this species
// growing right now" — fertilize gating and the daily tick both consult it.
function season_growth_multiplier(_species, _season) {
    var _active = _species.seasons_active;
    var _is_active = false;
    for (var i = 0; i < array_length(_active); i++) {
        if (_active[i] == _season) { _is_active = true; break; }
    }
    if (!_is_active) return 0;

    switch (_season) {
        case "spring": return 1.3;
        case "summer": return 1.0;
        case "autumn": return 0.5;
        case "winter": return 0.4;   // for species that list winter as active
        default:       return 1.0;
    }
}

// Water decay multiplier. Species-agnostic for now — even dormant deciduous
// transpire a little through bark, so winter is reduced but not zero. Summer
// pulls hardest.
function season_water_multiplier(_season) {
    switch (_season) {
        case "spring": return 1.0;
        case "summer": return 1.5;
        case "autumn": return 0.7;
        case "winter": return 0.3;
        default:       return 1.0;
    }
}
