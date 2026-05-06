// scr_tutorial
// Linear-progress new-player onboarding. global.tutorial_step holds the
// current step (or TUT_DONE if finished/skipped). The corner panel drawn from
// obj_game_controller's Draw GUI shows the active step's prompt; gameplay
// callsites advance the step via tutorial_advance_if(...) when the player
// performs the matching action. New games start at TUT_WATER (player meets
// Granny's inherited juniper); existing saves without the field load as
// TUT_DONE so veterans aren't dropped back into onboarding.

#macro TUT_DONE      -1
#macro TUT_WATER      0
#macro TUT_SKIP_WEEK  1
#macro TUT_TRAIN      2

// Sentinel: when advancing from TUT_LAST, we jump to TUT_DONE. PR2 extends
// this to TUT_PLANT after inserting TUT_TAKE_CUTTING and TUT_PLANT.
#macro TUT_LAST       TUT_TRAIN

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
        case TUT_WATER:     return "Water Granny's juniper";
        case TUT_SKIP_WEEK: return "Skip a week on the inspector";
        case TUT_TRAIN:     return "Train a branch in the 3D viewer";
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
    }
    return "";
}
