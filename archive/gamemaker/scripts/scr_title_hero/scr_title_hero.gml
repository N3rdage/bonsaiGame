// scr_title_hero
// Hand-crafted hero tree for the title screen. Built once on title load,
// rendered with the same mesh pipeline as the in-game viewer. Numbers picked
// for silhouette: alternating left/right branches, taper toward the apex,
// one wired bend for visual interest, mild trunk movement for character.

function build_title_hero_tree() {
    var _t = new BonsaiTree("juniper", "seed");
    _t.name = "Hero";
    _t.trunk.height_cm = 35;
    _t.trunk.girth_mm  = 28;
    _t.trunk.taper     = 0.62;
    _t.trunk.movement  = [{ y: 18, angle_deg: 8 }];

    _t.add_branch(-1, 10, 35,  14);
    _t.add_branch(-1, 16, 210, 13);
    _t.add_branch(-1, 22, 100, 12);
    _t.add_branch(-1, 27, 280, 10);
    _t.add_branch(-1, 30, 60,   9);
    _t.add_branch(-1, 33, 175,  7);

    // One wired branch for legible training cue
    _t.branches[2].wired = true;
    _t.branches[2].bend  = 22;

    _t.foliage_density = 0.78;
    _t.mesh_dirty      = true;
    return _t;
}
