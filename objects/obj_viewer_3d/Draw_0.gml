// obj_viewer_3d — Draw event

// Draw the pot the tree sits in (terracotta, or glazed-celadon-with-feet for fancy)
_draw_pot();

// Draw the tree mesh — bark untextured, foliage textured with alpha cutoff
var _m = matrix_build(0, 0, 0, 0, 0, 0, 1, 1, 1);
matrix_set(matrix_world, _m);
var _mesh = tree.get_mesh();
vertex_submit(_mesh.bark, pr_trianglelist, -1);

// Foliage pass: leaf texture + alpha test for crisp see-through edges; no
// culling because cross-quads need both faces visible from any camera angle.
gpu_set_alphatestenable(true);
gpu_set_alphatestref(128);
gpu_set_cullmode(cull_noculling);
vertex_submit(_mesh.foliage, pr_trianglelist, sprite_get_texture(spr_foliage, 0));
gpu_set_cullmode(cull_counterclockwise);
gpu_set_alphatestenable(false);

matrix_set(matrix_world, matrix_build_identity());

// Bottom of Draw event

// A real 3D pot the tree sits in, built fresh each frame (cheap — one small
// buffer). Colours come from the shared pot_palette so the 3D view agrees with
// the 2D world sprite. Geometry, z-up (soil surface at z=0, base below):
//   - tapered frustum body, vertical body->dark gradient for a sense of depth
//   - overhanging rim lip (top annulus + a short outer band)
//   - soil surface recessed just inside the rim so the trunk reads as planted
//   - fancy pots (tier 1) get four feet underneath
// Drawn no-cull so winding never matters; cull mode restored afterwards.
function _draw_pot() {
    var _pal   = pot_palette(tree.pot_tier);
    var _scale = BONSAI_DISPLAY_SCALE;

    var _r_top  =  0.100 * _scale;   // body radius at the rim
    var _r_bot  =  0.072 * _scale;   // body radius at the base (tapered in)
    var _depth  =  0.060 * _scale;   // soil surface at z=0 down to base at -depth
    var _lip    =  0.014 * _scale;   // rim overhang past the body
    var _lip_h  =  0.016 * _scale;   // rim band height
    var _soil_z = -0.012 * _scale;   // soil sits a touch below the rim
    var _r_soil =  _r_top - 0.010 * _scale;
    var _segs   = 28;

    var _body = _pal.body;
    var _dark = _pal.body_line;
    var _rim  = _pal.rim;
    var _soil = make_color_rgb(48, 34, 24);

    var _vb = vertex_create_buffer();
    vertex_begin(_vb, global.vformat_3d);

    for (var i = 0; i < _segs; i++) {
        var _a1 = (i / _segs) * 360;
        var _a2 = ((i + 1) / _segs) * 360;
        var _c1 = dcos(_a1), _s1 = dsin(_a1);
        var _c2 = dcos(_a2), _s2 = dsin(_a2);

        // Body wall (frustum), top body-colour -> bottom dark for depth
        var _wt1 = vec3(_c1 * _r_top, _s1 * _r_top, 0);
        var _wt2 = vec3(_c2 * _r_top, _s2 * _r_top, 0);
        var _wb1 = vec3(_c1 * _r_bot, _s1 * _r_bot, -_depth);
        var _wb2 = vec3(_c2 * _r_bot, _s2 * _r_bot, -_depth);
        add_vertex(_vb, _wt1, _body, 0, 0);
        add_vertex(_vb, _wt2, _body, 0, 0);
        add_vertex(_vb, _wb2, _dark, 0, 0);
        add_vertex(_vb, _wt1, _body, 0, 0);
        add_vertex(_vb, _wb2, _dark, 0, 0);
        add_vertex(_vb, _wb1, _dark, 0, 0);

        // Base cap underneath
        add_vertex(_vb, vec3(0, 0, -_depth), _dark, 0, 0);
        add_vertex(_vb, _wb1, _dark, 0, 0);
        add_vertex(_vb, _wb2, _dark, 0, 0);

        // Rim lip: top annulus (r_top -> r_top+lip) then a short outer band
        var _ro1 = vec3(_c1 * (_r_top + _lip), _s1 * (_r_top + _lip), 0);
        var _ro2 = vec3(_c2 * (_r_top + _lip), _s2 * (_r_top + _lip), 0);
        _pot_quad(_vb, _wt1, _ro1, _ro2, _wt2, _rim);
        var _rb1 = vec3(_c1 * (_r_top + _lip), _s1 * (_r_top + _lip), -_lip_h);
        var _rb2 = vec3(_c2 * (_r_top + _lip), _s2 * (_r_top + _lip), -_lip_h);
        _pot_quad(_vb, _ro1, _rb1, _rb2, _ro2, _rim);

        // Soil surface, recessed inside the rim
        add_vertex(_vb, vec3(0, 0, _soil_z), _soil, 0, 0);
        add_vertex(_vb, vec3(_c1 * _r_soil, _s1 * _r_soil, _soil_z), _soil, 0, 0);
        add_vertex(_vb, vec3(_c2 * _r_soil, _s2 * _r_soil, _soil_z), _soil, 0, 0);
    }

    // Fancy pots stand on four feet
    if (tree.pot_tier == 1) {
        var _fr = _r_bot * 0.62;
        var _fw = 0.022 * _scale;
        var _fh = 0.026 * _scale;
        for (var f = 0; f < 4; f++) {
            var _fa = 45 + f * 90;
            _pot_box(_vb, dcos(_fa) * _fr, dsin(_fa) * _fr, -_depth, _fw, _fh, _body, _dark);
        }
    }

    vertex_end(_vb);

    gpu_set_cullmode(cull_noculling);
    vertex_submit(_vb, pr_trianglelist, -1);
    gpu_set_cullmode(cull_counterclockwise);
    vertex_delete_buffer(_vb);
}

// Two-triangle quad in a single colour. Pot draws no-cull, so winding order
// is irrelevant here.
function _pot_quad(_b, _p1, _p2, _p3, _p4, _col) {
    add_vertex(_b, _p1, _col, 0, 0);
    add_vertex(_b, _p2, _col, 0, 0);
    add_vertex(_b, _p3, _col, 0, 0);
    add_vertex(_b, _p1, _col, 0, 0);
    add_vertex(_b, _p3, _col, 0, 0);
    add_vertex(_b, _p4, _col, 0, 0);
}

// A small rectangular foot hanging from the pot base at (cx,cy,top_z): four
// side walls in _side and a base cap in _base. Top face omitted (it abuts the
// pot underside).
function _pot_box(_b, _cx, _cy, _top_z, _half, _h, _side, _base) {
    var _z1 = _top_z - _h;
    var _A  = vec3(_cx - _half, _cy - _half, _top_z);
    var _B  = vec3(_cx + _half, _cy - _half, _top_z);
    var _C  = vec3(_cx + _half, _cy + _half, _top_z);
    var _D  = vec3(_cx - _half, _cy + _half, _top_z);
    var _A2 = vec3(_cx - _half, _cy - _half, _z1);
    var _B2 = vec3(_cx + _half, _cy - _half, _z1);
    var _C2 = vec3(_cx + _half, _cy + _half, _z1);
    var _D2 = vec3(_cx - _half, _cy + _half, _z1);
    _pot_quad(_b, _A, _B, _B2, _A2, _side);
    _pot_quad(_b, _B, _C, _C2, _B2, _side);
    _pot_quad(_b, _C, _D, _D2, _C2, _side);
    _pot_quad(_b, _D, _A, _A2, _D2, _side);
    _pot_quad(_b, _A2, _B2, _C2, _D2, _base);
}