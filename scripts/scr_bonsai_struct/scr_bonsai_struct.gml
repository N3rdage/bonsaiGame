// scr_bonsai_struct
// Core data model for a bonsai tree.

function BonsaiTree(_species_key, _origin) constructor {
    // Identity
    id           = global.next_tree_id++;
    species_key  = _species_key;
    origin       = _origin;
    name         = "";
    
    // Lifecycle
    age_days             = 0;
    vitality             = 100;
    vigor                = 50;
    water_level          = 50;
    last_watered_day     = 0;
    last_fed_day         = 0;
    fertilized_until_day = 0;   // game_day < this => 1.5x growth multiplier
    pot_tier             = 0;   // 0 = standard, 1 = fancy (1.25x display revenue)
    in_pot               = undefined;
    location             = "inventory";
    time_accel           = 1.0;
    
    // Morphology — read by the 3D mesh builder
    trunk = {
        height_cm:  2.0,
        girth_mm:   3.0,
        taper:      0.7,
        movement:   [],
    };
    
	branches = [];
	foliage_density = 0.3;

	// Cuttings come with a small existing structure; seeds start bare.
	// We do this after construction so `add_branch` works correctly.
    
    // Training history
    wires_applied  = [];
    clips_history  = [];
    prunes_history = [];
    repots_history = [];
    
    style_tags = [];

    // Player-chosen target style. Empty string = no target. Otherwise a key
    // into global.styles (see scr_styles_data). Feeds the style-conformance
    // criterion in score_tree (scr_scoring).
    target_style = "";
    
    // Mesh cache
    mesh_cache = undefined;
    mesh_dirty = true;
    
    static get_species = function() {
        return global.species[$ species_key];
    }
    
    static add_branch = function(_parent_id, _y_cm, _angle_deg, _length_cm) {
        var _b = {
            id:        array_length(branches),
            parent_id: _parent_id,
            origin_y:  _y_cm,
            angle:     _angle_deg,
            length:    _length_cm,
            girth:     max(2, _length_cm * 0.3),
            wired:     false,
            bend:      0,   // horizontal sweep (degrees, around world +z)
            bend_v:    0,   // vertical sweep (degrees, around horizontal axis perpendicular to initial branch direction)
        };
        array_push(branches, _b);
        mesh_dirty = true;
        return _b.id;
    }
    
    static needs_water = function() {
        return water_level < 30;
    }
    
    static mark_dirty = function() {
        mesh_dirty = true;
    }
    
    // mesh_cache holds { bark, foliage } — two frozen vertex buffers.
    // See scr_bonsai_mesh.build_tree_mesh.
    static get_mesh = function() {
        if (mesh_dirty || mesh_cache == undefined) {
            if (mesh_cache != undefined) {
                vertex_delete_buffer(mesh_cache.bark);
                vertex_delete_buffer(mesh_cache.foliage);
            }
            mesh_cache = build_tree_mesh(self);
            mesh_dirty = false;
        }
        return mesh_cache;
    }
	
	// Initialize morphology based on origin
    if (_origin == "cutting") {
        trunk.height_cm = 8;
        trunk.girth_mm  = 4;
        add_branch(-1, 3, 45,  3);
        add_branch(-1, 5, 225, 2.5);
        foliage_density = 0.25;
    } else if (_origin == "seed") {
        trunk.height_cm = 2;
        trunk.girth_mm  = 1.5;
        foliage_density = 0.1;
    }
}