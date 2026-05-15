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
