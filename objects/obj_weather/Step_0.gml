// obj_weather -- Step event
// Advance particles: fall, horizontal wind + sine sway, spin, glow, and (for
// hover kinds) a vertical bob. Particles wrap toroidally within the play area
// (+ margin) so the field stays full. On season rollover the field is rebuilt.

if (!weather_enabled()) exit;   // respect the Settings toggle; freeze when off

// Cheap periodic season recheck -- season only changes when the day advances.
season_check_timer++;
if (season_check_timer >= 30) {
    season_check_timer = 0;
    var _s = current_season();
    if (_s != active_season) {
        active_season = _s;
        build_particles();
    }
}

var _lo_x = area_x0 - margin, _hi_x = area_x1 + margin;
var _lo_y = area_y0 - margin, _hi_y = area_y1 + margin;
var _span_x = _hi_x - _lo_x;
var _span_y = _hi_y - _lo_y;
var _wind = profile.wind;

for (var _i = 0; _i < array_length(parts); _i++) {
    var _p = parts[_i];
    _p.y      += _p.vy;
    _p.bx     += _wind;
    _p.phase  += _p.spd;
    _p.phasey += _p.spdy;
    _p.rot    += _p.rspd;
    _p.gph    += _p.spd * 0.5;

    // Toroidal wrap. bx is the sway pivot; the drawn x adds the sine offset.
    if (_p.bx < _lo_x) _p.bx += _span_x; else if (_p.bx > _hi_x) _p.bx -= _span_x;
    if (_p.y  < _lo_y) _p.y  += _span_y; else if (_p.y  > _hi_y) _p.y  -= _span_y;
}
