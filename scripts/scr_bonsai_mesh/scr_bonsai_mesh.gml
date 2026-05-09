// scr_bonsai_mesh
// Builds a 3D vertex buffer from a BonsaiTree struct.

#macro BONSAI_DISPLAY_SCALE 4         // 1 sim cm renders as 4 "viewer units"
#macro BONSAI_TRUNK_BEND_PER_EVENT 20 // degrees of tangent deflection per trunk-wire click
#macro BONSAI_BRANCH_BEND_PER_CLICK 15 // degrees of bend added per branch-wire click

// Returns { bark, foliage } — two frozen vertex buffers. Bark is submitted
// untextured (vertex-coloured); foliage is submitted with a leaf texture and
// alpha cutoff (PR2). Splitting them lets each pass set its own GPU state
// without bleeding alpha config onto bark triangles.
function build_tree_mesh(_tree) {
    var _bark = vertex_create_buffer();
    var _foliage = vertex_create_buffer();
    vertex_begin(_bark, global.vformat_3d);
    vertex_begin(_foliage, global.vformat_3d);

    build_trunk(_bark, _tree);
    for (var i = 0; i < array_length(_tree.branches); i++) {
        build_branch(_bark, _foliage, _tree, _tree.branches[i]);
    }

    vertex_end(_bark);
    vertex_end(_foliage);
    vertex_freeze(_bark);
    vertex_freeze(_foliage);
    return { bark: _bark, foliage: _foliage };
}

// Sample N+1 parallel-transported frames along the trunk's curve. Frame i has
// { pos, tangent, normal, binormal } — an orthonormal right-handed basis where
// tangent is the trunk's local "up" direction. The starting tangent is world
// +z; each `trunk.movement` event below the current sample height deflects the
// tangent (and the whole frame, via Rodrigues) by BONSAI_TRUNK_BEND_PER_EVENT
// degrees toward (cos angle_deg, sin angle_deg, 0). Position integrates from
// tangent step-by-step, so trunk.height_cm now reads as arc length: a curved
// trunk is shorter vertically than its arc length, which matches how wire-bent
// real trunks behave.
function trunk_frames(_tree) {
    var _trunk        = _tree.trunk;
    var _arc_world    = (_trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;
    var _segments     = max(8, floor(_arc_world * 20));

    // Sort movement events by height. Rotations don't commute, so the trunk
    // bends event-by-event from the base upward; an event at y=5 rotates
    // everything above y=5, including subsequent events' deflection axes.
    var _events_n = array_length(_trunk.movement);
    var _events   = array_create(_events_n);
    for (var i = 0; i < _events_n; i++) _events[i] = _trunk.movement[i];
    array_sort(_events, function(_a, _b) { return _a.y - _b.y; });

    var _frames = array_create(_segments + 1);
    var _pos    = vec3(0, 0, 0);
    var _T      = vec3(0, 0, 1);
    var _N      = vec3(1, 0, 0);
    var _B      = vec3(0, 1, 0);
    var _ds     = (_segments > 0) ? (_arc_world / _segments) : 0;
    var _next_event = 0;

    for (var i = 0; i <= _segments; i++) {
        var _t       = (_segments > 0) ? (i / _segments) : 0;
        var _arc_now = _t * _arc_world;

        // Apply any events whose height we've reached or passed.
        // Axis is world_up × d, NOT current_T × d: using current_T flips sign
        // when the trunk passes horizontal (cascade case), so further bends
        // would un-bend the trunk instead of continuing the cascade. With a
        // world-frame axis, cumulative bends compose consistently no matter
        // how much the trunk has already curved.
        while (_next_event < _events_n) {
            var _ev          = _events[_next_event];
            var _ev_arc      = (_ev.y / 100) * BONSAI_DISPLAY_SCALE;
            if (_ev_arc > _arc_now) break;

            // up × d, with up = (0,0,1), d = (cos, sin, 0), simplifies to
            // (-sin, cos, 0) — already unit-length.
            var _ax = vec3(-dsin(_ev.angle_deg), dcos(_ev.angle_deg), 0);
            _T = vec3_rotate(_T, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
            _N = vec3_rotate(_N, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
            _B = vec3_rotate(_B, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
            _next_event++;
        }

        _frames[i] = {
            pos:      _pos,
            tangent:  _T,
            normal:   _N,
            binormal: _B,
        };

        if (i < _segments) {
            _pos = vec3(_pos.x + _T.x * _ds, _pos.y + _T.y * _ds, _pos.z + _T.z * _ds);
        }
    }

    return _frames;
}

// Frame at fractional height _t in [0..1] along the trunk arc. Linearly
// interpolates between sampled frames and renormalises — adjacent frames
// differ only by small angles, so lerp+renormalise is a cheap stand-in for
// slerp. Used by branch_point and the wire anchor for any-height lookups.
function trunk_frame_at(_tree, _t) {
    var _frames = trunk_frames(_tree);
    var _n      = array_length(_frames);
    if (_n == 0) {
        return {
            pos:      vec3(0, 0, 0),
            tangent:  vec3(0, 0, 1),
            normal:   vec3(1, 0, 0),
            binormal: vec3(0, 1, 0),
        };
    }
    if (_n == 1) return _frames[0];

    var _idx_f = clamp(_t, 0, 1) * (_n - 1);
    var _i0    = floor(_idx_f);
    var _i1    = min(_i0 + 1, _n - 1);
    var _f     = _idx_f - _i0;
    var _a     = _frames[_i0];
    var _b     = _frames[_i1];

    return {
        pos:      vec3(lerp(_a.pos.x, _b.pos.x, _f),
                       lerp(_a.pos.y, _b.pos.y, _f),
                       lerp(_a.pos.z, _b.pos.z, _f)),
        tangent:  vec3_normalize(vec3(lerp(_a.tangent.x, _b.tangent.x, _f),
                                      lerp(_a.tangent.y, _b.tangent.y, _f),
                                      lerp(_a.tangent.z, _b.tangent.z, _f))),
        normal:   vec3_normalize(vec3(lerp(_a.normal.x, _b.normal.x, _f),
                                      lerp(_a.normal.y, _b.normal.y, _f),
                                      lerp(_a.normal.z, _b.normal.z, _f))),
        binormal: vec3_normalize(vec3(lerp(_a.binormal.x, _b.binormal.x, _f),
                                      lerp(_a.binormal.y, _b.binormal.y, _f),
                                      lerp(_a.binormal.z, _b.binormal.z, _f))),
    };
}

// Ring of `_segments` vertices around `_centre` in the plane spanned by the
// EXPLICIT basis vectors (_u, _v). Differs from build_oriented_ring, which
// derives U/V from a reference axis cross product — that method's reference-
// axis switch can flip vertex ordering between consecutive rings, twisting
// the geometry. Parallel-transported frames give us a continuous (U, V) that
// matches across rings, so we want them passed in directly.
function build_ring_with_basis(_centre, _radius, _segments, _u, _v) {
    var _ring = array_create(_segments);
    for (var i = 0; i < _segments; i++) {
        var _a  = (i / _segments) * 360;
        var _ca = dcos(_a);
        var _sa = dsin(_a);
        _ring[i] = vec3(
            _centre.x + (_ca * _u.x + _sa * _v.x) * _radius,
            _centre.y + (_ca * _u.y + _sa * _v.y) * _radius,
            _centre.z + (_ca * _u.z + _sa * _v.z) * _radius
        );
    }
    return _ring;
}

function build_trunk(_vbuff, _tree) {
    var _trunk        = _tree.trunk;
    var _base_radius  = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;

    var _frames         = trunk_frames(_tree);
    var _n              = array_length(_frames);
    var _segments_round = 10;
    var _bark_col       = make_color_rgb(90, 60, 40);

    var _prev_ring = undefined;
    for (var i = 0; i < _n; i++) {
        var _t = (_n > 1) ? (i / (_n - 1)) : 0;
        var _r = lerp(_base_radius, _base_radius * (1 - _trunk.taper), _t);
        _r = max(_r, 0.001);

        var _f    = _frames[i];
        var _ring = build_ring_with_basis(_f.pos, _r, _segments_round, _f.normal, _f.binormal);
        if (_prev_ring != undefined) {
            stitch_rings(_vbuff, _prev_ring, _ring, _bark_col);
        }
        _prev_ring = _ring;
    }
}

// Shared by build_branch and the 3D viewer's hotspot code.
// t_along: 0 = trunk-surface origin, 1 = branch tip.
//
// Branches carry two bend scalars (degrees) interpreted as the total angular
// sweep over the branch's length:
//   - branch.bend (horizontal): rotates the tangent around world +z
//   - branch.bend_v (vertical): rotates the tangent around the horizontal axis
//                               perpendicular to the initial branch direction
// Rotation order is V-then-H, so bend_v=0 collapses exactly to the horizontal-
// only behaviour (closed-form circular-arc integral). With both axes active,
// the rotation composition no longer admits a closed form, so position is
// integrated numerically over a small number of steps.
function branch_point(_tree, _branch, _t_along) {
    var _trunk = _tree.trunk;
    var _ot    = clamp(_branch.origin_y / _trunk.height_cm, 0, 1);

    var _tf      = trunk_frame_at(_tree, _ot);
    var _base_r  = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;
    var _trunk_r = lerp(_base_r, _base_r * (1 - _trunk.taper), _ot);

    // Branch attaches to the trunk surface in a direction expressed in the
    // trunk's LOCAL basis: cos(angle) along normal, sin(angle) along binormal.
    var _ca0 = dcos(_branch.angle);
    var _sa0 = dsin(_branch.angle);
    var _ox  = _tf.pos.x + (_ca0 * _tf.normal.x + _sa0 * _tf.binormal.x) * _trunk_r;
    var _oy  = _tf.pos.y + (_ca0 * _tf.normal.y + _sa0 * _tf.binormal.y) * _trunk_r;
    var _oz  = _tf.pos.z + (_ca0 * _tf.normal.z + _sa0 * _tf.binormal.z) * _trunk_r;

    var _length_m = (_branch.length / 100) * BONSAI_DISPLAY_SCALE;
    var _bend_v   = variable_struct_exists(_branch, "bend_v") ? _branch.bend_v : 0;

    var _hx, _hy, _hz;
    if (abs(_bend_v) < 0.001) {
        // Pure horizontal — closed-form arc integral + linear z lift.
        if (abs(_branch.bend) < 0.001) {
            _hx = _length_m * _t_along * _ca0;
            _hy = _length_m * _t_along * _sa0;
        } else {
            // ∫ cos(a0 + κs) ds = (1/κ) * (sin(a0 + κs) - sin(a0))
            // Convert κ from rad to deg via the (180/π) factor.
            var _angle_t = _branch.angle + _branch.bend * _t_along;
            var _scale   = (_length_m / _branch.bend) * (180 / pi);
            _hx = _scale * (dsin(_angle_t) - dsin(_branch.angle));
            _hy = _scale * (-dcos(_angle_t) + dcos(_branch.angle));
        }
        _hz = _length_m * _t_along * 0.25;
    } else {
        // Mixed bend — numerical integration. T0 stays unnormalised (mag
        // sqrt(1.0625)) so its z component matches the legacy 0.25 lift.
        var _v_axis = vec3(_sa0, -_ca0, 0);
        var _zaxis  = vec3(0, 0, 1);
        var _T0     = vec3(_ca0, _sa0, 0.25);
        var _N      = 12;
        var _ds     = _length_m * _t_along / _N;
        _hx = 0; _hy = 0; _hz = 0;
        for (var i = 0; i < _N; i++) {
            var _u  = (i + 0.5) / _N * _t_along;
            var _Tv = vec3_rotate(_T0, _v_axis, _bend_v * _u);
            var _T  = vec3_rotate(_Tv, _zaxis, _branch.bend * _u);
            _hx += _T.x * _ds;
            _hy += _T.y * _ds;
            _hz += _T.z * _ds;
        }
    }

    return vec3(_ox + _hx, _oy + _hy, _oz + _hz);
}

// Frame at fractional length _t along the branch. With bend_v=0 the frame is
// closed-form (cos/sin direct). With bend_v ≠ 0, rotate the initial unit frame
// by R_v then R_h — same composition order as the position integral above, so
// tangent here matches the integrand exactly.
function branch_frame_at(_tree, _branch, _t) {
    var _pos = branch_point(_tree, _branch, _t);

    var _bend_v = variable_struct_exists(_branch, "bend_v") ? _branch.bend_v : 0;
    var _ca0 = dcos(_branch.angle);
    var _sa0 = dsin(_branch.angle);
    var _inv = 1 / sqrt(1.0625);

    if (abs(_bend_v) < 0.001) {
        // Pure horizontal — closed-form rotation of the initial frame.
        var _angle_t = _branch.angle + _branch.bend * _t;
        var _ca = dcos(_angle_t);
        var _sa = dsin(_angle_t);
        return {
            pos:      _pos,
            tangent:  vec3(_ca * _inv,        _sa * _inv,        0.25 * _inv),
            normal:   vec3(-_sa,              _ca,               0),
            binormal: vec3(-0.25 * _ca * _inv, -0.25 * _sa * _inv, _inv),
        };
    }

    // Mixed: rotate initial T0/N0/B0 by R_v(bend_v*t) then R_h(bend_h*t).
    var _v_axis = vec3(_sa0, -_ca0, 0);
    var _zaxis  = vec3(0, 0, 1);
    var _T0     = vec3(_ca0 * _inv,         _sa0 * _inv,         0.25 * _inv);
    var _N0     = vec3(-_sa0,               _ca0,                0);
    var _B0     = vec3(-0.25 * _ca0 * _inv, -0.25 * _sa0 * _inv, _inv);

    var _av = _bend_v * _t;
    var _ah = _branch.bend * _t;

    var _Tv = vec3_rotate(_T0, _v_axis, _av);
    var _Nv = vec3_rotate(_N0, _v_axis, _av);
    var _Bv = vec3_rotate(_B0, _v_axis, _av);

    return {
        pos:      _pos,
        tangent:  vec3_rotate(_Tv, _zaxis, _ah),
        normal:   vec3_rotate(_Nv, _zaxis, _ah),
        binormal: vec3_rotate(_Bv, _zaxis, _ah),
    };
}

function build_branch(_bark, _foliage, _tree, _branch) {
    var _segs = 6;
    var _bark_col = make_color_rgb(110, 75, 50);
    var _prev_ring = undefined;

    for (var i = 0; i <= _segs; i++) {
        var _ft = i / _segs;
        var _pt = branch_point(_tree, _branch, _ft);
        var _r = lerp((_branch.girth / 1000) * BONSAI_DISPLAY_SCALE,
                      (_branch.girth / 1000) * 0.2 * BONSAI_DISPLAY_SCALE, _ft);
        _r = max(_r, 0.005);

        var _ring = build_ring(_pt, _r, 6);
        if (_prev_ring != undefined) {
            stitch_rings(_bark, _prev_ring, _ring, _bark_col);
        }
        _prev_ring = _ring;
    }

    if (_branch.wired) {
        add_wire_coil(_bark, _tree, _branch);
    }

    var _t_origin = clamp(_branch.origin_y / _tree.trunk.height_cm, 0, 1);
    if (_t_origin > 0.3) {
        var _tip = branch_point(_tree, _branch, 1);
        var _species = _tree.get_species();
        var _seed = _tree.id * 1000 + _branch.id;
        add_foliage_cluster(_foliage, _tip, _species.leaf_color, _tree.foliage_density, _seed);
    }
}

// Wire coil around a wired branch. Copper-coloured helix, oriented rings
// perpendicular to the local helix tangent (not the branch axis — the helix
// pitch is tight enough that branch-axis rings would visibly skew). Pitch and
// thickness scale with branch girth and bend severity, mirroring real bonsai
// wire-gauge selection (gauge ratio 0.33–0.5 of branch diameter, denser pitch
// for thicker wire). Per-sample local frame from branch_frame_at, so the coil
// follows the branch's curve instead of being glued to a constant forward.
function add_wire_coil(_vbuff, _tree, _branch) {
    var _wire_col = make_color_rgb(180, 110, 50);

    // Thickness: scales with branch girth and bend magnitude
    var _branch_r_base = (_branch.girth / 1000) * BONSAI_DISPLAY_SCALE;
    var _bend_factor   = clamp(abs(_branch.bend) / 60, 0, 1);
    var _wire_r        = max(0.002, _branch_r_base * lerp(0.15, 0.30, _bend_factor));

    // Pitch: ~3 wire-diameters per turn ("comfortable wrap" spacing — visible
    // gap between turns, looks like hand-applied training wire). Real-bonsai
    // max-contact wrap is 1.5×, but at our render contrast that ends up reading
    // as a tightly-compressed spring. Thicker wire → fewer, wider turns.
    var _pitch        = 3 * (2 * _wire_r);
    var _length_world = (_branch.length / 100) * BONSAI_DISPLAY_SCALE;
    var _turns        = max(1, _length_world / _pitch);

    // Helix sampling
    var _segs_per_turn = 8;
    var _segs          = max(20, ceil(_turns * _segs_per_turn));
    var _ring_segs     = 6;

    // Tangent magnitudes for the helix (used to derive ring normals)
    var _axial_speed       = _length_world;
    var _radial_speed_base = _turns * 2 * pi;   // radians per unit s

    var _prev_ring = undefined;
    for (var i = 0; i <= _segs; i++) {
        var _s     = i / _segs;
        var _theta = _s * _turns * 360;
        var _ca    = dcos(_theta);
        var _sa    = dsin(_theta);

        var _f = branch_frame_at(_tree, _branch, _s);

        // Branch radius tapers; wire offset rides on it
        var _branch_r_here = lerp(_branch_r_base, _branch_r_base * 0.2, _s);
        var _offset        = _branch_r_here + _wire_r;

        var _centre = vec3(
            _f.pos.x + (_ca * _f.normal.x + _sa * _f.binormal.x) * _offset,
            _f.pos.y + (_ca * _f.normal.y + _sa * _f.binormal.y) * _offset,
            _f.pos.z + (_ca * _f.normal.z + _sa * _f.binormal.z) * _offset
        );

        // Helix tangent = axial (along branch tangent) + radial (around branch).
        // Same construction as add_wire_anchor; magnitudes are length per unit s.
        var _radial_mag = _offset * _radial_speed_base;
        var _tan_x = _f.tangent.x * _axial_speed + (-_sa * _f.normal.x + _ca * _f.binormal.x) * _radial_mag;
        var _tan_y = _f.tangent.y * _axial_speed + (-_sa * _f.normal.y + _ca * _f.binormal.y) * _radial_mag;
        var _tan_z = _f.tangent.z * _axial_speed + (-_sa * _f.normal.z + _ca * _f.binormal.z) * _radial_mag;
        var _tlen  = sqrt(_tan_x*_tan_x + _tan_y*_tan_y + _tan_z*_tan_z);
        _tan_x /= _tlen; _tan_y /= _tlen; _tan_z /= _tlen;

        var _ring = build_oriented_ring(_centre, _wire_r, _ring_segs, _tan_x, _tan_y, _tan_z);
        if (_prev_ring != undefined) {
            stitch_rings(_vbuff, _prev_ring, _ring, _wire_col);
        }
        _prev_ring = _ring;
    }

    add_wire_anchor(_vbuff, _tree, _branch, _wire_r, _wire_col);
}

// Trunk-side anchor for a branch wire. In real bonsai, wire is anchored by
// wrapping the trunk 1–2 turns before going onto the branch — this stops the
// wire rotating freely when the branch is bent. Here it's purely visual: a
// short helix around the trunk axis at the branch's base, ending on the side
// the branch attaches so the eye reads the anchor as feeding into the branch
// coil. The helix axis follows the trunk's local tangent so the anchor stays
// glued to a leaning trunk.
function add_wire_anchor(_vbuff, _tree, _branch, _wire_r, _col) {
    var _trunk = _tree.trunk;
    var _t = clamp(_branch.origin_y / _trunk.height_cm, 0, 1);

    var _base_r  = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;
    var _trunk_r = lerp(_base_r, _base_r * (1 - _trunk.taper), _t);

    var _f = trunk_frame_at(_tree, _t);

    var _anchor_turns = 1.5;
    var _anchor_pitch = 3 * (2 * _wire_r);   // matches branch coil pitch
    var _anchor_h     = _anchor_turns * _anchor_pitch;
    var _offset       = _trunk_r + _wire_r;

    // Sweep ends on the branch-attachment side, sweeping back from there
    var _end_angle   = _branch.angle;
    var _start_angle = _end_angle - _anchor_turns * 360;

    var _segs = max(16, ceil(_anchor_turns * 8));
    var _ring_segs = 6;

    var _axial_speed       = _anchor_h;
    var _radial_speed_base = _anchor_turns * 2 * pi;

    var _prev_ring = undefined;
    for (var i = 0; i <= _segs; i++) {
        var _s     = i / _segs;
        var _theta = lerp(_start_angle, _end_angle, _s);
        var _ca    = dcos(_theta);
        var _sa    = dsin(_theta);
        // s in [0..1] runs the anchor from below the branch to above it,
        // along the trunk's local tangent — not world +z.
        var _axial = (_s - 0.5) * _anchor_h;

        var _centre = vec3(
            _f.pos.x + (_ca * _f.normal.x + _sa * _f.binormal.x) * _offset + _f.tangent.x * _axial,
            _f.pos.y + (_ca * _f.normal.y + _sa * _f.binormal.y) * _offset + _f.tangent.y * _axial,
            _f.pos.z + (_ca * _f.normal.z + _sa * _f.binormal.z) * _offset + _f.tangent.z * _axial
        );

        // Helix tangent in world space: axial component along trunk tangent +
        // radial component tangent to the circle (in the normal/binormal plane).
        var _radial_mag = _offset * _radial_speed_base;
        var _radial_x = (-_sa * _f.normal.x + _ca * _f.binormal.x) * _radial_mag;
        var _radial_y = (-_sa * _f.normal.y + _ca * _f.binormal.y) * _radial_mag;
        var _radial_z = (-_sa * _f.normal.z + _ca * _f.binormal.z) * _radial_mag;

        var _tan_x = _f.tangent.x * _axial_speed + _radial_x;
        var _tan_y = _f.tangent.y * _axial_speed + _radial_y;
        var _tan_z = _f.tangent.z * _axial_speed + _radial_z;
        var _tlen  = sqrt(_tan_x*_tan_x + _tan_y*_tan_y + _tan_z*_tan_z);
        _tan_x /= _tlen; _tan_y /= _tlen; _tan_z /= _tlen;

        var _ring = build_oriented_ring(_centre, _wire_r, _ring_segs, _tan_x, _tan_y, _tan_z);
        if (_prev_ring != undefined) {
            stitch_rings(_vbuff, _prev_ring, _ring, _col);
        }
        _prev_ring = _ring;
    }
}

// Ring of `_segments` vertices around `_centre`, in the plane perpendicular to
// the unit vector (_nx, _ny, _nz). Used by tubes whose axis isn't aligned
// with z (e.g. the wire helix). The reference axis switches when the normal
// is nearly parallel to z to avoid the cross-product collapsing.
function build_oriented_ring(_centre, _radius, _segments, _nx, _ny, _nz) {
    var _ref_x, _ref_y, _ref_z;
    if (abs(_nz) < 0.95) { _ref_x = 0; _ref_y = 0; _ref_z = 1; }
    else                 { _ref_x = 1; _ref_y = 0; _ref_z = 0; }

    var _ux = _ref_y * _nz - _ref_z * _ny;
    var _uy = _ref_z * _nx - _ref_x * _nz;
    var _uz = _ref_x * _ny - _ref_y * _nx;
    var _ulen = sqrt(_ux*_ux + _uy*_uy + _uz*_uz);
    if (_ulen < 0.0001) _ulen = 1;
    _ux /= _ulen; _uy /= _ulen; _uz /= _ulen;

    var _vx = _ny * _uz - _nz * _uy;
    var _vy = _nz * _ux - _nx * _uz;
    var _vz = _nx * _uy - _ny * _ux;

    var _ring = array_create(_segments);
    for (var i = 0; i < _segments; i++) {
        var _a  = (i / _segments) * 360;
        var _ca = dcos(_a);
        var _sa = dsin(_a);
        _ring[i] = vec3(
            _centre.x + (_ca * _ux + _sa * _vx) * _radius,
            _centre.y + (_ca * _uy + _sa * _vy) * _radius,
            _centre.z + (_ca * _uz + _sa * _vz) * _radius
        );
    }
    return _ring;
}

function build_ring(_center, _radius, _segments) {
    var _ring = array_create(_segments);
    for (var i = 0; i < _segments; i++) {
        var _a = (i / _segments) * 360;
        _ring[i] = vec3(
            _center.x + dcos(_a) * _radius,
            _center.y + dsin(_a) * _radius,
            _center.z
        );
    }
    return _ring;
}

function stitch_rings(_vbuff, _ring_a, _ring_b, _col) {
    var _n = array_length(_ring_a);
    for (var i = 0; i < _n; i++) {
        var _j = (i + 1) mod _n;
        var _a1 = _ring_a[i], _a2 = _ring_a[_j];
        var _b1 = _ring_b[i], _b2 = _ring_b[_j];
        
        add_vertex(_vbuff, _a1, _col, 0, 0);
        add_vertex(_vbuff, _b1, _col, 0, 1);
        add_vertex(_vbuff, _a2, _col, 1, 0);
        
        add_vertex(_vbuff, _a2, _col, 1, 0);
        add_vertex(_vbuff, _b1, _col, 0, 1);
        add_vertex(_vbuff, _b2, _col, 1, 1);
    }
}

function add_vertex(_vbuff, _p, _col, _u, _v) {
    vertex_position_3d(_vbuff, _p.x, _p.y, _p.z);
    vertex_normal(_vbuff, 0, 0, 1);
    vertex_texcoord(_vbuff, _u, _v);
    vertex_color(_vbuff, _col, 1);
}

// Stable across rebuilds: callers pass a deterministic _seed (e.g. tree.id * 1000
// + branch.id) so the same cluster regenerates with the same offsets. Without
// this, every mesh_dirty rebuild rerolls every leaf and the whole tree appears
// to jitter on any morphology change.
function add_foliage_cluster(_vbuff, _center, _col, _density, _seed) {
    var _saved_seed = random_get_seed();
    random_set_seed(_seed);

    var _count = floor(4 + _density * 6);
    // Leaf size should scale with the tree's display scale but stay small
    var _size  = (0.008 + _density * 0.006) * BONSAI_DISPLAY_SCALE;
    var _spread = 0.025 * BONSAI_DISPLAY_SCALE;

    for (var i = 0; i < _count; i++) {
        var _ox = random_range(-_spread, _spread);
        var _oy = random_range(-_spread, _spread);
        var _oz = random_range(-_spread * 0.5, _spread * 0.5);
        var _c  = vec3(_center.x + _ox, _center.y + _oy, _center.z + _oz);

        _add_quad_xz(_vbuff, _c, _size, _col);
        _add_quad_yz(_vbuff, _c, _size, _col);
    }

    random_set_seed(_saved_seed);
}

function _add_quad_xz(_vbuff, _c, _s, _col) {
    var _p1 = vec3(_c.x - _s, _c.y, _c.z - _s);
    var _p2 = vec3(_c.x + _s, _c.y, _c.z - _s);
    var _p3 = vec3(_c.x + _s, _c.y, _c.z + _s);
    var _p4 = vec3(_c.x - _s, _c.y, _c.z + _s);
    add_vertex(_vbuff, _p1, _col, 0, 0);
    add_vertex(_vbuff, _p2, _col, 1, 0);
    add_vertex(_vbuff, _p3, _col, 1, 1);
    add_vertex(_vbuff, _p1, _col, 0, 0);
    add_vertex(_vbuff, _p3, _col, 1, 1);
    add_vertex(_vbuff, _p4, _col, 0, 1);
}

function _add_quad_yz(_vbuff, _c, _s, _col) {
    var _p1 = vec3(_c.x, _c.y - _s, _c.z - _s);
    var _p2 = vec3(_c.x, _c.y + _s, _c.z - _s);
    var _p3 = vec3(_c.x, _c.y + _s, _c.z + _s);
    var _p4 = vec3(_c.x, _c.y - _s, _c.z + _s);
    add_vertex(_vbuff, _p1, _col, 0, 0);
    add_vertex(_vbuff, _p2, _col, 1, 0);
    add_vertex(_vbuff, _p3, _col, 1, 1);
    add_vertex(_vbuff, _p1, _col, 0, 0);
    add_vertex(_vbuff, _p3, _col, 1, 1);
    add_vertex(_vbuff, _p4, _col, 0, 1);
}