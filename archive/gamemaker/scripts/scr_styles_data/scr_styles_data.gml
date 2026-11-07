// scr_styles_data
// Traditional bonsai styles. The player picks a target style per tree
// (BonsaiTree.target_style), and `score_tree` (scr_scoring) feeds the tree
// into the style's `score(_tree)` function as one weighted criterion.
//
// Each style's `score(_tree)` returns a 0..1 conformance value. Trunk-shape
// styles (informal_upright, slanting, cascade) read the trunk's curve via
// trunk_frames(_tree) — the same parallel-transported frame walk that drives
// the mesh, so what the player sees IS what they're scored on.
//
// Call init_styles() once at game start.

function init_styles() {
    global.styles = {
        formal_upright: {
            key:          "formal_upright",
            display_name: "Formal Upright (Chokkan)",
            description:  "Straight vertical trunk; branches alternating evenly.",
            score: function(_tree) {
                // Reward consecutive branches (sorted by height) that point
                // in opposite directions.
                var _n = array_length(_tree.branches);
                if (_n < 2) return 0.5;

                var _sorted = array_create(_n);
                array_copy(_sorted, 0, _tree.branches, 0, _n);
                array_sort(_sorted, function(_a, _b) {
                    return _a.origin_y - _b.origin_y;
                });

                var _sum = 0;
                for (var i = 0; i < _n - 1; i++) {
                    var _diff = abs(_sorted[i].angle - _sorted[i + 1].angle);
                    _diff = min(_diff, 360 - _diff); // shortest arc, [0..180]
                    _sum += _diff / 180;             // 1.0 when opposite, 0 when same dir
                }
                return _sum / (_n - 1);
            },
        },
        informal_upright: {
            key:          "informal_upright",
            display_name: "Informal Upright (Moyogi)",
            description:  "Gently curved trunk; the most natural form.",
            score: function(_tree) {
                // Reward visible curve along the trunk that returns to vertical
                // at the apex — the S-curve silhouette of a Moyogi. Two factors
                // multiplied:
                //  - max lean along the trunk peaks at ~25° (gentle curve)
                //  - apex lean stays near vertical
                var _frames = trunk_frames(_tree);
                var _n = array_length(_frames);
                if (_n < 2) return 0;
                var _max_lean = 0;
                for (var i = 0; i < _n; i++) {
                    var _l = darccos(clamp(_frames[i].tangent.z, -1, 1));
                    if (_l > _max_lean) _max_lean = _l;
                }
                var _apex_lean = darccos(clamp(_frames[_n - 1].tangent.z, -1, 1));
                var _curve_score   = max(0, 1 - abs(_max_lean - 25) / 25);
                var _upright_score = max(0, 1 - _apex_lean / 30);
                return _curve_score * _upright_score;
            },
        },
        slanting: {
            key:          "slanting",
            display_name: "Slanting (Shakan)",
            description:  "Trunk leans noticeably to one side.",
            score: function(_tree) {
                // Reward an apex that leans in the 25..45° band, with bend
                // events all pointing the same direction (no S-curve).
                var _frames = trunk_frames(_tree);
                var _n = array_length(_frames);
                if (_n < 2) return 0;
                var _apex_lean = darccos(clamp(_frames[_n - 1].tangent.z, -1, 1));

                // Plateau 25..45°, falls off outside.
                var _lean_score = max(0, 1 - max(abs(_apex_lean - 35) - 10, 0) / 30);

                // Direction consistency: cosine-mean of bend-event angles
                // relative to the first event. 1 = perfectly aligned, 0 or
                // negative = scattered or reversing.
                var _movement = _tree.trunk.movement;
                var _events_n = array_length(_movement);
                if (_events_n == 0) return 0;
                var _ref = _movement[0].angle_deg;
                var _consistent = 0;
                for (var i = 0; i < _events_n; i++) {
                    _consistent += dcos(_movement[i].angle_deg - _ref);
                }
                var _consistency = max(0, _consistent / _events_n);

                return _lean_score * _consistency;
            },
        },
        cascade: {
            key:          "cascade",
            display_name: "Cascade (Kengai)",
            description:  "Main growth descends below the pot's rim.",
            score: function(_tree) {
                // Reward the trunk tip dropping below the base. Full marks at
                // a drop equal to ~half the trunk's arc length below the base
                // (a textbook Kengai descent). Linear scale below that.
                var _frames = trunk_frames(_tree);
                var _n = array_length(_frames);
                if (_n < 2) return 0;
                var _drop = _frames[0].pos.z - _frames[_n - 1].pos.z;
                if (_drop <= 0) return 0;
                var _arc = (_tree.trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;
                if (_arc <= 0) return 0;
                return clamp(_drop / (_arc * 0.5), 0, 1);
            },
        },
        broom: {
            key:          "broom",
            display_name: "Broom (Hokidachi)",
            description:  "Straight trunk fans into a dome of branches.",
            score: function(_tree) {
                var _n = array_length(_tree.branches);
                if (_n == 0 || _tree.trunk.height_cm <= 0) return 0;

                // Two factors, multiplied: branches in the upper third of
                // the trunk, and a wide radial spread of angles.
                var _upper = 0;
                var _sx = 0; var _sy = 0;
                for (var i = 0; i < _n; i++) {
                    var _t = _tree.branches[i].origin_y / _tree.trunk.height_cm;
                    if (_t >= 0.66) _upper += 1;
                    var _a = degtorad(_tree.branches[i].angle);
                    _sx += cos(_a);
                    _sy += sin(_a);
                }
                var _upper_frac = _upper / _n;
                var _r          = sqrt(_sx * _sx + _sy * _sy) / _n;
                var _spread     = 1 - _r; // 1 = wide, 0 = bunched
                return _upper_frac * _spread;
            },
        },
        windswept: {
            key:          "windswept",
            display_name: "Windswept (Fukinagashi)",
            description:  "All growth swept in one direction.",
            score: function(_tree) {
                var _n = array_length(_tree.branches);
                if (_n < 2) return 0.5;

                var _sx = 0; var _sy = 0;
                for (var i = 0; i < _n; i++) {
                    var _a = degtorad(_tree.branches[i].angle);
                    _sx += cos(_a);
                    _sy += sin(_a);
                }
                // Mean resultant length: 1 = perfectly aligned, 0 = scattered.
                return sqrt(_sx * _sx + _sy * _sy) / _n;
            },
        },
    };
}
