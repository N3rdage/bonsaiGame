// obj_viewer_3d — Draw event

// Draw a simple pedestal/pot so the tree isn't floating
_draw_pedestal();

// Draw the tree mesh
var _m = matrix_build(0, 0, 0, 0, 0, 0, 1, 1, 1);
matrix_set(matrix_world, _m);
vertex_submit(tree.get_mesh(), pr_trianglelist, -1);  // -1 = no texture, uses vertex colours
matrix_set(matrix_world, matrix_build_identity());

// Bottom of Draw event

function _draw_pedestal() {
    // A flat disc under the tree so it doesn't look like it's floating in the void
    var _col = make_color_rgb(70, 55, 45);
    var _r = 0.08 * BONSAI_DISPLAY_SCALE;
    var _z = 0;
    var _segs = 20;
    
    var _vbuff = vertex_create_buffer();
    vertex_begin(_vbuff, global.vformat_3d);
    
    for (var i = 0; i < _segs; i++) {
        var _a1 = (i / _segs) * 360;
        var _a2 = ((i + 1) / _segs) * 360;
        var _x1 = dcos(_a1) * _r, _y1 = dsin(_a1) * _r;
        var _x2 = dcos(_a2) * _r, _y2 = dsin(_a2) * _r;
        
        add_vertex(_vbuff, vec3(0, 0, _z), _col, 0, 0);
        add_vertex(_vbuff, vec3(_x1, _y1, _z), _col, 0, 0);
        add_vertex(_vbuff, vec3(_x2, _y2, _z), _col, 0, 0);
    }
    
    vertex_end(_vbuff);
    vertex_submit(_vbuff, pr_trianglelist, -1);
    vertex_delete_buffer(_vbuff);
}