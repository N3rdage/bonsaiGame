// obj_weather -- Create event
// Ambient weather particles for the current room. Spawned by the game
// controller's Room Start for the garden (full seasonal weather) and the shed
// (faint indoor dust motes). Non-persistent, so it dies on room change; the
// 3D viewer and title screen never spawn one. See scr_weather for the profiles.

// Draw in front of the world (the instance layer, player included, sits at
// depth 0) so the weather reads as a foreground layer falling past the scene.
depth = -1000;

indoor = (room == rm_shed);

// Confine particles to the visible play area. The shed is an inset cozy
// interior (SHED_* wall ring); the garden fills the whole room.
if (indoor) {
    area_x0 = SHED_X0; area_y0 = SHED_Y0;
    area_x1 = SHED_X1; area_y1 = SHED_Y1;
} else {
    area_x0 = 0; area_y0 = 0;
    area_x1 = room_width; area_y1 = room_height;
}
margin = 24;   // spawn / wrap band just outside the visible area

active_season      = current_season();
season_check_timer = 0;

// (Re)build the particle field for the active season. Called on create and
// whenever the season rolls over mid-visit (e.g. after a debug week-skip).
build_particles = function() {
    profile = weather_profile(active_season, indoor);
    parts   = [];
    var _w = area_x1 - area_x0;
    var _h = area_y1 - area_y0;
    for (var _i = 0; _i < profile.count; _i++) {
        // Scatter across the whole area (not all at the top) so the field is
        // already populated on frame 1.
        array_push(parts, {
            bx:     area_x0 + random(_w),   // sway pivot x
            y:      area_y0 + random(_h),
            vy:     random_range(profile.fall_min, profile.fall_max),
            amp:    random_range(profile.sway_amp_min, profile.sway_amp_max),
            phase:  random(360),
            spd:    random_range(profile.sway_spd_min, profile.sway_spd_max),
            ampy:   profile.hover ? random_range(profile.sway_amp_min, profile.sway_amp_max) * 0.7 : 0,
            phasey: random(360),
            spdy:   profile.hover ? random_range(profile.sway_spd_min, profile.sway_spd_max) * 0.8 : 0,
            size:   random_range(profile.size_min, profile.size_max),
            rot:    random(360),
            rspd:   profile.rot ? random_range(-1.6, 1.6) : 0,
            col:    profile.cols[irandom(array_length(profile.cols) - 1)],
            gph:    random(360),            // glow / shimmer phase
        });
    }
};
build_particles();
