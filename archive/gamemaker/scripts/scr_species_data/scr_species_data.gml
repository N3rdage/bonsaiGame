// scr_species_data
// Call init_species() once at game start.
//
// Per-season foliage colour lives in `seasonal: { spring, summer, autumn, winter }`.
// A season set to `undefined` means "drop foliage entirely this season"
// (deciduous winter-bare). `leaf_color` is the default / fallback used by code
// paths that don't know about seasons (e.g. the inspector's species swatch).

function init_species() {
    global.species = {
        juniper: {
            display_name:   "Juniper",
            growth_rate:    1.0,
            water_need:     0.8,
            leaf_color:     #4a6741,
            leaf_shape:     "needle",
            max_trunk_cm:   45,
            suitable_styles:["informal_upright", "cascade", "windswept"],
            propagation:    ["cutting", "seed"],
            seasons_active: ["spring", "summer", "autumn"],
            seasonal: {
                spring: #5c7d4f,   // fresh-growth brighter green
                summer: #4a6741,   // mature green (default)
                autumn: #4a6741,   // evergreen — no shift
                winter: #5c5a3a,   // muted bronze, cold-stress tint
            },
        },
        maple: {
            display_name:   "Japanese Maple",
            growth_rate:    1.2,
            water_need:     1.2,
            leaf_color:     #b33a2a,
            leaf_shape:     "palmate",
            max_trunk_cm:   60,
            suitable_styles:["informal_upright", "broom"],
            propagation:    ["seed"],
            seasons_active: ["spring", "summer", "autumn"],
            seasonal: {
                spring: #6da542,    // fresh chartreuse new leaves
                summer: #3a7a2a,    // deep mature green
                autumn: #b33a2a,    // iconic fiery red (matches leaf_color)
                winter: undefined,  // deciduous — drop foliage entirely
            },
        },
        pine: {
            display_name:   "Pine",
            growth_rate:    0.7,
            water_need:     0.6,
            leaf_color:     #3a5a3a,
            leaf_shape:     "needle",
            max_trunk_cm:   50,
            suitable_styles:["formal_upright", "informal_upright", "windswept"],
            propagation:    ["seed"],
            seasons_active: ["spring", "summer", "autumn", "winter"],
            seasonal: {
                spring: #4a7a4a,   // new candles, lighter
                summer: #3a5a3a,   // mature green (default)
                autumn: #3a5a3a,
                winter: #2e4a2e,   // slightly darker cool tone
            },
        },
    };
}

// Returns the foliage colour to use for `_species` in `_season`, or `undefined`
// to indicate "drop foliage this season" (deciduous winter-bare). Falls back to
// `_species.leaf_color` when the species struct has no `seasonal` block — keeps
// callers safe even for hypothetical mod species added without seasonal data.
function species_seasonal_color(_species, _season) {
    if (!variable_struct_exists(_species, "seasonal")) return _species.leaf_color;
    var _s = _species.seasonal;
    if (!variable_struct_exists(_s, _season))          return _species.leaf_color;
    return _s[$ _season];
}