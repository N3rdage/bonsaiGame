// scr_tutorial
// Linear-progress new-player onboarding. global.tutorial_step holds the
// current step (or TUT_DONE if finished/skipped). The corner panel drawn from
// obj_game_controller's Draw GUI shows the active step's prompt; gameplay
// callsites advance the step via tutorial_advance_if(...) when the player
// performs the matching action. New games start at TUT_WATER (player meets
// Granny's inherited juniper); existing saves without the field load as
// TUT_DONE so veterans aren't dropped back into onboarding.

#macro TUT_DONE         -1
#macro TUT_WATER         0
#macro TUT_SKIP_WEEK     1
#macro TUT_TRAIN         2
#macro TUT_TAKE_CUTTING  3
#macro TUT_PLANT         4

// Sentinel: when advancing from TUT_LAST, we jump to TUT_DONE. New steps go
// before this, not after, so progression keeps reaching the end cleanly.
#macro TUT_LAST          TUT_PLANT

function tutorial_init_for_new_game() {
    global.tutorial_step = TUT_WATER;
}

function tutorial_init_for_load(_save) {
    if (variable_struct_exists(_save, "tutorial_step")) {
        global.tutorial_step = _save.tutorial_step;
    } else {
        global.tutorial_step = TUT_DONE;
    }
}

// No-op unless we're actually on the step the caller expects. This keeps
// callsites idempotent — clicking Water at step TRAIN doesn't rewind us.
function tutorial_advance_if(_from) {
    if (global.tutorial_step != _from) return;
    global.tutorial_step = (_from >= TUT_LAST) ? TUT_DONE : (_from + 1);
}

function tutorial_skip() {
    global.tutorial_step = TUT_DONE;
}

function tutorial_step_label(_step) {
    switch (_step) {
        case TUT_WATER:        return "Water Granny's juniper";
        case TUT_SKIP_WEEK:    return "Skip a week on the inspector";
        case TUT_TRAIN:        return "Train a branch in the 3D viewer";
        case TUT_TAKE_CUTTING: return "Take a cutting from the source plant";
        case TUT_PLANT:        return "Plant your cutting at the workbench";
    }
    return "";
}

function tutorial_step_body(_step) {
    switch (_step) {
        case TUT_WATER:
            return "Press E on Granny's juniper to inspect it, then click Water.";
        case TUT_SKIP_WEEK:
            return "On the inspector, click Skip 7d to fast-forward a week.";
        case TUT_TRAIN:
            return "Inspect the tree, click Inspect 3D, pick a tool (Wire / Clip / Prune), then click a branch.";
        case TUT_TAKE_CUTTING:
            return "Head out to the back garden and press E on the source plant.";
        case TUT_PLANT:
            return "Press E on the workbench, select your cutting, and click Plant.";
    }
    return "";
}

// Longer flavour text for the notebook page. Includes the bonsai context the
// corner panel doesn't have room for.
function tutorial_step_flavour(_step) {
    switch (_step) {
        case TUT_WATER:
            return "Bonsai dry out faster than houseplants - small pots, lots of leaf surface for their soil volume. Watch the Water bar in the inspector; below 30 the tree starts to suffer. A click of Water tops it back to 100.";
        case TUT_SKIP_WEEK:
            return "Real bonsai is a slow craft - you might wait a season for a branch to thicken. Skip 7d fast-forwards a week of care, costing fertilizer (it stands in for the daily attention you'd be giving the tree).";
        case TUT_TRAIN:
            return "Three tools shape a tree. Wire bends a branch (sets permanently after about 8 weeks). Clip shortens a branch without removing it. Prune removes the branch entirely. Open the 3D viewer from the inspector, pick a mode, and click a branch.";
        case TUT_TAKE_CUTTING:
            return "Junipers propagate easily from cuttings - snip a branch and root it in soil to get a clone of the parent. Source plants live in the back garden; each offers a few cuttings before needing time to recover.";
        case TUT_PLANT:
            return "A cutting needs a pot to live in. The planting table at the workbench takes one cutting and one pot and creates a new tree at sapling size (8cm). Fancy pots cost more but earn more daily revenue when the tree is on display.";
        case TUT_DONE:
            return "Granny would be proud. The basic care, training, and propagation loop is yours now. Try selling a tree once it scores well, or buying a fancier pot from the shop kiosk. The notebook stays - flip back here any time with J.";
    }
    return "";
}

// Ordered list of every tutorial step, oldest to newest. The notebook
// iterates this for paging.
function tutorial_all_steps() {
    return [TUT_WATER, TUT_SKIP_WEEK, TUT_TRAIN, TUT_TAKE_CUTTING, TUT_PLANT];
}

// "completed" if past it, "active" if on it, "locked" if not yet reached.
// TUT_DONE means everything is completed.
function tutorial_step_status(_step) {
    if (global.tutorial_step == TUT_DONE) return "completed";
    if (_step < global.tutorial_step)     return "completed";
    if (_step == global.tutorial_step)    return "active";
    return "locked";
}
