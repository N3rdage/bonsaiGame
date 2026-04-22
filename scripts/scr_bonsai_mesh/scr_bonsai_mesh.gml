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

function build_branch(_vbuff, _tree, _branch) {
	var _trunk_h_m = (_tree.trunk.height_cm / 100) * BONSAI_DISPLAY_SCALE;
    var _t = _branch.origin_y / _tree.trunk.height_cm;
    _t = clamp(_t, 0, 1);
    var _origin_z = _t * _trunk_h_m;
    
	var _trunk_r = lerp(
        ((_tree.trunk.girth_mm / 1000) / 2) * BONSAI_DISPLAY_SCALE,
        ((_tree.trunk.girth_mm / 1000) / 2) * (1 - _tree.trunk.taper) * BONSAI_DISPLAY_SCALE,
        _t
    );
    var _ox = dcos(_branch.angle) * _trunk_r;
    var _oy = dsin(_branch.angle) * _trunk_r;
    var _origin = vec3(_ox, _oy, _origin_z);
    
    var _dir_angle = _branch.angle + _branch.bend;
    var _length_m  = (_branch.length / 100) * BONSAI_DISPLAY_SCALE;
    var _segs = 6;
    
    var _bark_col = make_color_rgb(110, 75, 50);
    var _prev_ring = undefined;
    
    for (var i = 0; i <= _segs; i++) {
        var _ft = i / _segs;
        var _pt = vec3(
            _origin.x + dcos(_dir_angle) * _length_m * _ft,
            _origin.y + dsin(_dir_angle) * _length_m * _ft,
            _origin.z + _length_m * _ft * 0.25
        );
        var _r = lerp((_branch.girth / 1000) * BONSAI_DISPLAY_SCALE,
                      (_branch.girth / 1000) * 0.2 * BONSAI_DISPLAY_SCALE, _ft);
        _r = max(_r, 0.005);
        
        var _ring = build_ring(_pt, _r, 6);
        if (_prev_ring != undefined) {
            stitch_rings(_vbuff, _prev_ring, _ring, _bark_col);
        }
        _prev_ring = _ring;
    }
    
    if (_t > 0.3) {
        var _tip = vec3(
            _origin.x + dcos(_dir_angle) * _length_m,
            _origin.y + dsin(_dir_angle) * _length_m,
            _origin.z + _length_m * 0.25
        );
        var _species = _tree.get_species();
        add_foliage_cluster(_vbuff, _tip, _species.leaf_color, _tree.foliage_density);
    }
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

function add_foliage_cluster(_vbuff, _center, _col, _density) {
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