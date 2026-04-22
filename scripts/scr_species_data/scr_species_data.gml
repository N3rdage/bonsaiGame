// scr_species_data
// Call init_species() once at game start.

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
        },
    };
}