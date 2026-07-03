// scr_weather
// Ambient seasonal weather particles for the outdoor garden, plus faint indoor
// dust motes in the shed. Pure eye-candy derived from current_season()
// (scr_seasons) -- no persisted state, no save-format impact. obj_weather owns
// the particle array and calls weather_profile() to reshape it per season.
//
// Design mirrors the rest of the game: everything is hand-drawn in code (no GM
// particle system, no art assets). Particles render as tinted primitives --
// circles for snow / pollen / motes / fireflies, small rotated quads for the
// tumbling petals and leaves -- so nothing here blocks on the art pass.

// Is ambient weather switched on? Per-machine Settings toggle (scr_settings),
// defaulting on when absent (old settings.json / pre-bootstrap title screen).
function weather_enabled() {
    if (!variable_global_exists("settings")) return true;
    return global.settings[$ "weather"] ?? true;
}

// Returns a profile struct describing the weather for a season. `_indoor` picks
// the shed dust-mote variant (season-independent). Each particle chooses a
// colour from `cols`. Speeds are px/step at the room's 60fps. `hover` kinds add
// a vertical sine bob and near-zero fall so they wander in place rather than
// stream downward.
function weather_profile(_season, _indoor) {
    if (_indoor) {
        return {                                   // faint drifting dust motes
            kind: "motes", count: 10,
            fall_min: 0.04, fall_max: 0.14,
            sway_amp_min: 3, sway_amp_max: 9,
            sway_spd_min: 0.6, sway_spd_max: 1.4,
            size_min: 1.5, size_max: 3,
            wind: 0.03, rot: false, hover: true, glow: true, base_alpha: 0.28,
            cols: [make_color_rgb(232, 226, 200)],
        };
    }

    switch (_season) {
        case "spring":                             // cherry-blossom petals
            return {
                kind: "petals", count: 28,
                fall_min: 0.22, fall_max: 0.5,
                sway_amp_min: 12, sway_amp_max: 26,
                sway_spd_min: 1.0, sway_spd_max: 2.0,
                size_min: 3, size_max: 5,
                wind: 0.08, rot: true, hover: false, glow: false, base_alpha: 0.85,
                cols: [make_color_rgb(255, 214, 224),
                       make_color_rgb(255, 190, 212),
                       make_color_rgb(250, 226, 233)],
            };
        case "summer":                             // lazy fireflies
            return {
                kind: "fireflies", count: 14,
                fall_min: -0.08, fall_max: 0.08,
                sway_amp_min: 10, sway_amp_max: 22,
                sway_spd_min: 0.8, sway_spd_max: 1.8,
                size_min: 2.5, size_max: 4,
                wind: 0.0, rot: false, hover: true, glow: true, base_alpha: 0.9,
                cols: [make_color_rgb(214, 240, 140),
                       make_color_rgb(232, 246, 165)],
            };
        case "autumn":                             // tumbling leaves
            return {
                kind: "leaves", count: 24,
                fall_min: 0.24, fall_max: 0.55,
                sway_amp_min: 16, sway_amp_max: 34,
                sway_spd_min: 1.2, sway_spd_max: 2.2,
                size_min: 4, size_max: 7,
                wind: 0.1, rot: true, hover: false, glow: false, base_alpha: 0.92,
                cols: [make_color_rgb(210, 90, 40),
                       make_color_rgb(230, 140, 40),
                       make_color_rgb(178, 68, 30),
                       make_color_rgb(160, 112, 42)],
            };
        default:                                   // winter snow
            return {
                kind: "snow", count: 48,
                fall_min: 0.28, fall_max: 0.6,
                sway_amp_min: 8, sway_amp_max: 18,
                sway_spd_min: 0.8, sway_spd_max: 1.6,
                size_min: 2, size_max: 4,
                wind: 0.06, rot: false, hover: false, glow: false, base_alpha: 0.88,
                cols: [make_color_rgb(255, 255, 255),
                       make_color_rgb(226, 236, 246)],
            };
    }
}

// Draw a rotated filled quad (petal / leaf) in the current draw colour, using
// two triangles. Narrower than tall so it reads as a blade, not a square.
// _ang in degrees; GM screen space is y-down (rotation sense is purely visual).
function weather_draw_quad(_x, _y, _hw, _hh, _ang) {
    var _c = dcos(_ang), _s = dsin(_ang);
    var _x0 = _x + (-_hw) * _c - (-_hh) * _s, _y0 = _y + (-_hw) * _s + (-_hh) * _c;
    var _x1 = _x + ( _hw) * _c - (-_hh) * _s, _y1 = _y + ( _hw) * _s + (-_hh) * _c;
    var _x2 = _x + ( _hw) * _c - ( _hh) * _s, _y2 = _y + ( _hw) * _s + ( _hh) * _c;
    var _x3 = _x + (-_hw) * _c - ( _hh) * _s, _y3 = _y + (-_hw) * _s + ( _hh) * _c;
    draw_triangle(_x0, _y0, _x1, _y1, _x2, _y2, false);
    draw_triangle(_x0, _y0, _x2, _y2, _x3, _y3, false);
}
