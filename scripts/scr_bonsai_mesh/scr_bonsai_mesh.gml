// scr_bonsai_mesh
// Builds a 3D vertex buffer from a BonsaiTree struct.
// This is a crude starting point — trees will look rough until the
// bending math is replaced with proper parallel-transport frames.

#macro BONSAI_DISPLAY_SCALE 4   // 1 sim cm renders as 4 "viewer units"

function build_tree_mesh(_tree) {
    var _vbuff = vertex_create_buffer();
    vertex_begin(_vbuff, global.vformat_3d);
    
    build_trunk(_vbuff, _tree);
    for (var i = 0; i < array_length(_tree.branches); i++) {
        build_branch(_vbuff, _tree, _tree.branches[i]);
    }
    
    vertex_end(_vbuff);
    vertex_freeze(_vbuff);
    return _vbuff;
}

function build_trunk(_vbuff, _tree) {
    var _trunk = _tree.trunk;
	var _height_m    = (_trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;
    var _base_radius = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;
    
    var _segments_tall  = max(8, floor(_height_m * 20));
    var _segments_round = 10;
    
    var _moves = _trunk.movement;
    var _bark_col = make_color_rgb(90, 60, 40);
    
    var _prev_ring = undefined;
    
    for (var i = 0; i <= _segments_tall; i++) {
        var _t = i / _segments_tall;
        var _z = _t * _height_m;
        
        var _r = lerp(_base_radius, _base_radius * (1 - _trunk.taper), _t);
        _r = max(_r, 0.001);
        
        var _cursor_x = 0;
        var _cursor_y = 0;
        for (var m = 0; m < array_length(_moves); m++) {
            var _mh = _moves[m].y / _trunk.height_cm;
            if (_mh <= _t) {
                var _strength = (_t - _mh) * 0.05;
                _cursor_x += dcos(_moves[m].angle_deg) * _strength;
                _cursor_y += dsin(_moves[m].angle_deg) * _strength;
            }
        }
        
        var _center = vec3(_cursor_x, _cursor_y, _z);
        var _ring = build_ring(_center, _r, _segments_round);
        
        if (_prev_ring != undefined) {
            stitch_rings(_vbuff, _prev_ring, _ring, _bark_col);
        }
        _prev_ring = _ring;
    }
}

// Shared by build_branch and the 3D viewer's hotspot code.
// t_along: 0 = trunk-surface origin, 1 = branch tip.
function branch_point(_tree, _branch, _t_along) {
    var _trunk = _tree.trunk;
    var _t = clamp(_branch.origin_y / _trunk.height_cm, 0, 1);
    var _origin_z = _t * (_trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;

    var _base_r  = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;
    var _trunk_r = lerp(_base_r, _base_r * (1 - _trunk.taper), _t);

    var _ox = dcos(_branch.angle) * _trunk_r;
    var _oy = dsin(_branch.angle) * _trunk_r;

    var _dir_angle = _branch.angle + _branch.bend;
    var _length_m  = (_branch.length / 100) * BONSAI_DISPLAY_SCALE;

    return vec3(
        _ox + dcos(_dir_angle) * _length_m * _t_along,
        _oy + dsin(_dir_angle) * _length_m * _t_along,
        _origin_z + _length_m * _t_along * 0.25
    );
}

function build_branch(_vbuff, _tree, _branch) {
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
            stitch_rings(_vbuff, _prev_ring, _ring, _bark_col);
        }
        _prev_ring = _ring;
    }

    if (_branch.wired) {
        add_wire_coil(_vbuff, _tree, _branch);
    }

    var _t_origin = clamp(_branch.origin_y / _tree.trunk.height_cm, 0, 1);
    if (_t_origin > 0.3) {
        var _tip = branch_point(_tree, _branch, 1);
        var _species = _tree.get_species();
        var _seed = _tree.id * 1000 + _branch.id;
        add_foliage_cluster(_vbuff, _tip, _species.leaf_color, _tree.foliage_density, _seed);
    }
}

// Wire coil around a wired branch. Copper-coloured helix, oriented rings
// perpendicular to the local helix tangent (not the branch axis — the helix
// pitch is tight enough that branch-axis rings would visibly skew). Pitch and
// thickness scale with branch girth and bend severity, mirroring real bonsai
// wire-gauge selection (gauge ratio 0.33–0.5 of branch diameter, denser pitch
// for thicker wire).
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

    // Branch forward unit vector (matches the z-arc factor in branch_point)
    var _dir_angle = _branch.angle + _branch.bend;
    var _fx = dcos(_dir_angle);
    var _fy = dsin(_dir_angle);
    var _fz = 0.25;
    var _flen = sqrt(_fx*_fx + _fy*_fy + _fz*_fz);
    _fx /= _flen; _fy /= _flen; _fz /= _flen;

    // Local frame perpendicular to forward (right and up basis)
    var _rx, _ry, _rz, _ux, _uy, _uz;
    if (abs(_fz) < 0.95) {
        _rx = _fy; _ry = -_fx; _rz = 0;
        var _rl = sqrt(_rx*_rx + _ry*_ry);
        _rx /= _rl; _ry /= _rl;
    } else {
        _rx = 0; _ry = 1; _rz = 0;  // fallback for near-vertical branches
    }
    _ux = _ry * _fz - _rz * _fy;
    _uy = _rz * _fx - _rx * _fz;
    _uz = _rx * _fy - _ry * _fx;

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

        var _axis_pt = branch_point(_tree, _branch, _s);

        // Branch radius tapers; wire offset rides on it
        var _branch_r_here = lerp(_branch_r_base, _branch_r_base * 0.2, _s);
        var _offset        = _branch_r_here + _wire_r;

        var _centre = vec3(
            _axis_pt.x + (_ca * _rx + _sa * _ux) * _offset,
            _axis_pt.y + (_ca * _ry + _sa * _uy) * _offset,
            _axis_pt.z + (_ca * _rz + _sa * _uz) * _offset
        );

        // Helix tangent = axial component (along forward) + radial component
        // (around the branch). Magnitudes are length per unit s. Normalise
        // because build_oriented_ring expects a unit normal.
        var _radial_mag = _offset * _radial_speed_base;
        var _tan_x = _fx * _axial_speed + (-_sa * _rx + _ca * _ux) * _radial_mag;
        var _tan_y = _fy * _axial_speed + (-_sa * _ry + _ca * _uy) * _radial_mag;
        var _tan_z = _fz * _axial_speed + (-_sa * _rz + _ca * _uz) * _radial_mag;
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
// short helix around the trunk z-axis at the branch's base, ending on the
// side the branch attaches so the eye reads the anchor as feeding into the
// branch coil.
function add_wire_anchor(_vbuff, _tree, _branch, _wire_r, _col) {
    var _trunk = _tree.trunk;

    // Trunk z at the branch base
    var _t = clamp(_branch.origin_y / _trunk.height_cm, 0, 1);
    var _trunk_h_world = (_trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;
    var _z_centre = _t * _trunk_h_world;

    // Trunk radius at that z
    var _base_r = ((_trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE;
    var _trunk_r = lerp(_base_r, _base_r * (1 - _trunk.taper), _t);

    // Trunk centre at that z, accounting for movement (mirrors build_trunk)
    var _cursor_x = 0;
    var _cursor_y = 0;
    var _moves = _trunk.movement;
    for (var m = 0; m < array_length(_moves); m++) {
        var _mh = _moves[m].y / _trunk.height_cm;
        if (_mh <= _t) {
            var _strength = (_t - _mh) * 0.05;
            _cursor_x += dcos(_moves[m].angle_deg) * _strength;
            _cursor_y += dsin(_moves[m].angle_deg) * _strength;
        }
    }

    var _anchor_turns = 1.5;
    var _anchor_pitch = 3 * (2 * _wire_r);   // matches branch coil pitch
    var _anchor_h     = _anchor_turns * _anchor_pitch;
    var _z_start      = _z_centre - _anchor_h / 2;
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
        var _z     = _z_start + _s * _anchor_h;

        var _centre = vec3(
            _cursor_x + _ca * _offset,
            _cursor_y + _sa * _offset,
            _z
        );

        // Helix tangent: axial along world +z, radial tangent to circle
        var _radial_mag = _offset * _radial_speed_base;
        var _tan_x = -_sa * _radial_mag;
        var _tan_y =  _ca * _radial_mag;
        var _tan_z = _axial_speed;
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