// obj_weather -- Draw event (world space)
// Draw each particle as a tinted primitive. Foreground depth is set in Create,
// so this sits over the world but under the GUI (money / HUD / panels).

if (!weather_enabled()) exit;

var _kind = profile.kind;
for (var _i = 0; _i < array_length(parts); _i++) {
    var _p = parts[_i];
    var _dx = _p.bx + dsin(_p.phase)  * _p.amp;
    var _dy = _p.y  + dsin(_p.phasey) * _p.ampy;

    var _a = profile.base_alpha;
    if (profile.glow) _a *= 0.55 + 0.45 * dsin(_p.gph);   // shimmer / pulse
    _a = max(0, _a);
    draw_set_color(_p.col);

    switch (_kind) {
        case "leaves":
            draw_set_alpha(_a);
            weather_draw_quad(_dx, _dy, _p.size * 0.55, _p.size, _p.rot);
            break;
        case "petals":
            draw_set_alpha(_a);
            weather_draw_quad(_dx, _dy, _p.size * 0.5, _p.size * 0.8, _p.rot);
            break;
        case "fireflies":
            // soft glow: faint wide halo behind a brighter core
            draw_set_alpha(_a * 0.35);
            draw_circle(_dx, _dy, _p.size * 2.0, false);
            draw_set_alpha(_a);
            draw_circle(_dx, _dy, _p.size, false);
            break;
        default: // snow / motes -- simple soft dot
            draw_set_alpha(_a);
            draw_circle(_dx, _dy, _p.size, false);
            break;
    }
}

draw_set_alpha(1);
draw_set_color(c_white);
