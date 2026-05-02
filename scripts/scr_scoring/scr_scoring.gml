// scr_scoring
// Aesthetic scoring for a BonsaiTree. Returns a 0-100 total plus a per-criterion
// breakdown so the inspector can show what helped/hurt. Scoring is derived from
// morphology and never persisted — recompute on demand.
//
// MVP criteria (style-agnostic). Style conformance lands in a follow-up PR and
// will plug in here as another weighted criterion.

// Gaussian falloff: 1.0 at target, decays with distance.
function _score_gauss(_value, _target, _sigma) {
    var _d = _value - _target;
    return exp(-(_d * _d) / (2 * _sigma * _sigma));
}

// Band score: 1.0 inside [_lo, _hi], linear falloff to 0 over _falloff units.
function _score_band(_value, _lo, _hi, _falloff) {
    if (_value >= _lo && _value <= _hi) return 1.0;
    if (_value <  _lo) return max(0, 1 - (_lo - _value) / _falloff);
    return                 max(0, 1 - (_value - _hi) / _falloff);
}

function score_tree(_tree) {
    var _crits = [];
    var _n = array_length(_tree.branches);

    // 1. Trunk taper — classical bonsai taper sits around 0.6.
    var _v_taper = _score_gauss(_tree.trunk.taper, 0.6, 0.2);
    array_push(_crits, { label: "Trunk taper", value: _v_taper, weight: 1.0 });

    // 2. Trunk proportion — height (cm) vs girth (mm). Classic rule says the
    //    trunk should be 6-10× as tall as it is thick. height_cm * 10 / girth_mm
    //    converts to comparable units (cm/cm).
    var _ratio = (_tree.trunk.girth_mm > 0)
        ? (_tree.trunk.height_cm * 10 / _tree.trunk.girth_mm)
        : 999;
    var _v_prop = _score_band(_ratio, 6, 10, 5);
    array_push(_crits, { label: "Trunk proportion", value: _v_prop, weight: 1.0 });

    // 3. Branch count — sweet spot 3-7 for an MVP tree silhouette.
    var _v_count = _score_band(_n, 3, 7, 4);
    array_push(_crits, { label: "Branch count", value: _v_count, weight: 1.0 });

    // 4. Angular spread — penalize all-on-one-side. Mean resultant length of
    //    angle unit-vectors: 0 = well-spread, 1 = perfectly bunched.
    var _v_ang = 0;
    if (_n > 0) {
        var _sx = 0; var _sy = 0;
        for (var i = 0; i < _n; i++) {
            var _a = degtorad(_tree.branches[i].angle);
            _sx += cos(_a);
            _sy += sin(_a);
        }
        var _r = sqrt(_sx * _sx + _sy * _sy) / _n;
        _v_ang = 1 - _r;
    }
    array_push(_crits, { label: "Angular spread", value: _v_ang, weight: 1.0 });

    // 5. Vertical spread — std dev of origin_y / trunk_height. Sweet spot
    //    around 0.3 (branches distributed, not all bunched together).
    var _v_vert = 0;
    if (_n >= 2 && _tree.trunk.height_cm > 0) {
        var _h = _tree.trunk.height_cm;
        var _mean = 0;
        for (var i = 0; i < _n; i++) _mean += _tree.branches[i].origin_y / _h;
        _mean /= _n;
        var _var = 0;
        for (var i = 0; i < _n; i++) {
            var _d = _tree.branches[i].origin_y / _h - _mean;
            _var += _d * _d;
        }
        var _sd = sqrt(_var / _n);
        _v_vert = _score_gauss(_sd, 0.3, 0.15);
    } else if (_n == 1) {
        _v_vert = 0.3;
    }
    array_push(_crits, { label: "Vertical spread", value: _v_vert, weight: 1.0 });

    // 6. Foliage band — healthy density 0.3-0.7.
    var _v_fol = _score_band(_tree.foliage_density, 0.3, 0.7, 0.3);
    array_push(_crits, { label: "Foliage", value: _v_fol, weight: 1.0 });

    // 7. Style conformance — only when a target style is set, so choosing a
    //    style is a real commitment that can pull the score up or down.
    if (_tree.target_style != "" && variable_struct_exists(global.styles, _tree.target_style)) {
        var _style   = global.styles[$ _tree.target_style];
        var _v_style = _style.score(_tree);
        array_push(_crits, {
            label:  "Style: " + _style.display_name,
            value:  _v_style,
            weight: 1.5,
        });
    }

    // Sum weighted contributions, normalize to 0..1.
    var _sum = 0; var _wsum = 0;
    for (var i = 0; i < array_length(_crits); i++) {
        _sum  += _crits[i].value * _crits[i].weight;
        _wsum += _crits[i].weight;
    }
    var _base = (_wsum > 0) ? (_sum / _wsum) : 0;

    // 7. Vitality multiplier — sickly tree caps the score.
    var _vit_mult = _tree.vitality / 100;
    var _total    = _base * _vit_mult * 100;

    // Per-criterion point contributions for the breakdown view.
    for (var i = 0; i < array_length(_crits); i++) {
        var _c = _crits[i];
        _c.points = (_c.value * _c.weight / _wsum) * 100 * _vit_mult;
        _c.is_multiplier = false;
    }
    array_push(_crits, {
        label: "Vitality",
        value: _vit_mult,
        weight: 0,
        points: 0,
        is_multiplier: true,
    });

    return {
        total:     floor(_total),
        breakdown: _crits,
    };
}
