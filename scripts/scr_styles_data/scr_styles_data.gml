// scr_styles_data
// Traditional bonsai styles. The player picks a target style per tree
// (BonsaiTree.target_style), and `score_tree` (scr_scoring) feeds the tree
// into the style's `score(_tree)` function as one weighted criterion.
//
// Each style with a `score` field returns a 0..1 conformance value. Styles
// whose distinguishing feature is trunk shape (curvature/lean/descending
// growth) currently have no morphology field to read from — `trunk.movement`
// is unused and branches always angle upward — so they omit the function
// entirely. `score_tree` treats missing-score styles the same as "no target
// style": the criterion drops out of the weighted average. Real scoring
// lands when TODO #12 (proper trunk-bending math) gives those styles
// something to measure.
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
            // No score: needs trunk curvature data (see TODO #12).
        },
        slanting: {
            key:          "slanting",
            display_name: "Slanting (Shakan)",
            description:  "Trunk leans noticeably to one side.",
            // No score: needs trunk lean data (see TODO #12).
        },
        cascade: {
            key:          "cascade",
            display_name: "Cascade (Kengai)",
            description:  "Main growth descends below the pot's rim.",
            // No score: needs downward-growing branches / below-pot reach.
            // Current branches always angle upward (see TODO #12 family).
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
