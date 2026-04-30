// scr_styles_data
// Traditional bonsai styles. The player picks a target style per tree
// (BonsaiTree.target_style), which will drive aesthetic-scoring criteria
// in TODO #2. The criteria fields aren't here yet — this PR ships the
// names + descriptions so the upcoming style-picker UI has something to
// list; scoring fills in the criteria when it lands.
//
// Call init_styles() once at game start.

function init_styles() {
    global.styles = {
        formal_upright: {
            key:          "formal_upright",
            display_name: "Formal Upright (Chokkan)",
            description:  "Perfectly straight vertical trunk with branches alternating evenly. The classical, formal style.",
        },
        informal_upright: {
            key:          "informal_upright",
            display_name: "Informal Upright (Moyogi)",
            description:  "Trunk has a gentle S-curve as it rises. The most common natural form.",
        },
        slanting: {
            key:          "slanting",
            display_name: "Slanting (Shakan)",
            description:  "Trunk leans noticeably to one side, suggesting a tree shaped by wind or weight.",
        },
        cascade: {
            key:          "cascade",
            display_name: "Cascade (Kengai)",
            description:  "Main growth descends below the pot's rim, like a tree on a cliff face.",
        },
        broom: {
            key:          "broom",
            display_name: "Broom (Hokidachi)",
            description:  "Straight trunk fans out into a dome of branches near the top, like an old oak.",
        },
        windswept: {
            key:          "windswept",
            display_name: "Windswept (Fukinagashi)",
            description:  "Trunk and branches all swept in one direction, as if shaped by a constant wind.",
        },
    };
}
