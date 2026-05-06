// obj_title — Draw event

_draw_ground();

matrix_set(matrix_world, matrix_build(0, 0, 0, 0, 0, 0, 1, 1, 1));
vertex_submit(hero_mesh.bark, pr_trianglelist, -1);

// Foliage pass: leaf texture + alpha test + no-culling. See obj_viewer_3d Draw.
gpu_set_alphatestenable(true);
gpu_set_alphatestref(128);
gpu_set_cullmode(cull_noculling);
vertex_submit(hero_mesh.foliage, pr_trianglelist, sprite_get_texture(spr_foliage, 0));
gpu_set_cullmode(cull_counterclockwise);
gpu_set_alphatestenable(false);

matrix_set(matrix_world, matrix_build_identity());

function _draw_ground() {
    var _col = make_color_rgb(50, 42, 32);
    var _r = 0.18 * BONSAI_DISPLAY_SCALE;
    var _segs = 24;
    var _vbuff = vertex_create_buffer();
    vertex_begin(_vbuff, global.vformat_3d);
    for (var i = 0; i < _segs; i++) {
        var _a1 = (i / _segs) * 360;
        var _a2 = ((i + 1) / _segs) * 360;
        var _x1 = dcos(_a1) * _r, _y1 = dsin(_a1) * _r;
        var _x2 = dcos(_a2) * _r, _y2 = dsin(_a2) * _r;
        add_vertex(_vbuff, vec3(0, 0, 0), _col, 0, 0);
        add_vertex(_vbuff, vec3(_x1, _y1, 0), _col, 0, 0);
        add_vertex(_vbuff, vec3(_x2, _y2, 0), _col, 0, 0);
    }
    vertex_end(_vbuff);
    vertex_submit(_vbuff, pr_trianglelist, -1);
    vertex_delete_buffer(_vbuff);
}
