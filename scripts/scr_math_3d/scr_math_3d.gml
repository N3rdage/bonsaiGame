// scr_math_3d
// Vector helpers and 3D vertex format setup.

function vec3(_x, _y, _z) {
    return { x: _x, y: _y, z: _z };
}

function vec3_add(_a, _b) {
    return vec3(_a.x + _b.x, _a.y + _b.y, _a.z + _b.z);
}

function vec3_sub(_a, _b) {
    return vec3(_a.x - _b.x, _a.y - _b.y, _a.z - _b.z);
}

function vec3_scale(_v, _s) {
    return vec3(_v.x * _s, _v.y * _s, _v.z * _s);
}

function vec3_length(_v) {
    return sqrt(_v.x * _v.x + _v.y * _v.y + _v.z * _v.z);
}

function vec3_normalize(_v) {
    var _l = vec3_length(_v);
    if (_l == 0) return vec3(0, 0, 0);
    return vec3(_v.x / _l, _v.y / _l, _v.z / _l);
}

function vec3_cross(_a, _b) {
    return vec3(
        _a.y * _b.z - _a.z * _b.y,
        _a.z * _b.x - _a.x * _b.z,
        _a.x * _b.y - _a.y * _b.x
    );
}

// Rodrigues' rotation formula: rotate _v around unit axis _axis by _angle_deg.
// Caller must pass a unit axis. Used for parallel-transporting trunk frames as
// the trunk's tangent rotates through bend events.
function vec3_rotate(_v, _axis, _angle_deg) {
    var _ca  = dcos(_angle_deg);
    var _sa  = dsin(_angle_deg);
    var _dot = _axis.x * _v.x + _axis.y * _v.y + _axis.z * _v.z;
    var _cx  = _axis.y * _v.z - _axis.z * _v.y;
    var _cy  = _axis.z * _v.x - _axis.x * _v.z;
    var _cz  = _axis.x * _v.y - _axis.y * _v.x;
    var _k   = (1 - _ca) * _dot;
    return vec3(
        _v.x * _ca + _cx * _sa + _axis.x * _k,
        _v.y * _ca + _cy * _sa + _axis.y * _k,
        _v.z * _ca + _cz * _sa + _axis.z * _k
    );
}

// Call once at game start to build the 3D vertex format.
function init_vertex_format() {
    vertex_format_begin();
    vertex_format_add_position_3d();
    vertex_format_add_normal();
    vertex_format_add_texcoord();
    vertex_format_add_color();
    global.vformat_3d = vertex_format_end();
}

// Project a 3D world point to screen pixel coords using the active camera.
// Returns a {x, y} struct, or undefined if behind camera.
function project_3d_to_screen(_world_pos) {
    var _view = camera_get_view_mat(view_camera[0]);
    var _proj = camera_get_proj_mat(view_camera[0]);
    var _vp   = matrix_multiply(_view, _proj);
    
    var _x = _world_pos.x, _y = _world_pos.y, _z = _world_pos.z;
    var _cx = _vp[0]*_x + _vp[4]*_y + _vp[8] *_z + _vp[12];
    var _cy = _vp[1]*_x + _vp[5]*_y + _vp[9] *_z + _vp[13];
    var _cz = _vp[2]*_x + _vp[6]*_y + _vp[10]*_z + _vp[14];
    var _cw = _vp[3]*_x + _vp[7]*_y + _vp[11]*_z + _vp[15];
    if (_cw == 0 || _cz < 0) return undefined;
    
    var _ndc_x = _cx / _cw;
    var _ndc_y = _cy / _cw;
    
    return {
        x: (_ndc_x * 0.5 + 0.5) * window_get_width(),
        y: (1 - (_ndc_y * 0.5 + 0.5)) * window_get_height(),
    };
}