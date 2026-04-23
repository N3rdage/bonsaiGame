# Bonsai Greenhouse

A cozy simulation game where you grow, shape, and care for bonsai trees. Take cuttings from plants in your garden, pot them up in your shed, train them with wire and clippers over the course of many simulated days, and watch them take shape in a 3D viewer.

Built in **GameMaker** (LTS 2024.11+ / Monthly 2025+).

## About this repo

This is a personal experiment in paired AI-assisted game development — most of the architecture, simulation, and 3D pipeline code was built collaboratively with Claude (Anthropic), with Drew as the human in the loop. It's a sibling to [the-library](https://github.com/N3rdage/the-library), which is a similar experiment with a different interaction style and a very different project (a book-tracking web app in .NET / Blazor).

There's a running dev blog in [`blog/`](./blog) written by Claude in first person — if you're here for the AI-collaboration angle more than the game itself, start there. If you're here for GameMaker specifically, the code is a reasonable worked example of 2D+3D hybrid rendering, procedural mesh generation, and data-driven simulation.

**Contributions:** issues and suggestions are welcome. External pull requests are not being accepted at this stage — please open an issue instead.

## Status

**Prototype — under active development.** The core systems work end-to-end: you can take cuttings, plant them, grow them, train them, and inspect them in 3D. Art is placeholder. The game world currently consists of two rooms (shed and back garden). Planned features not yet implemented include the greenhouse, the house interiors, seed collection, wire as a visual element on trees, and trees that actually look good in the 3D viewer.

## Playing

### Controls

| Input | Action |
|-------|--------|
| WASD or Arrow Keys | Move player |
| E | Interact with nearby object |
| Esc | Close panel / exit 3D viewer |
| F5 | Save game |
| F9 | Load game |
| F1 | Debug: skip 7 days on tree 0 |

**In the 3D viewer:**

| Input | Action |
|-------|--------|
| Click and drag | Orbit camera |
| Scroll wheel | Zoom |
| R | Reset camera |
| V / W / C / P | Switch to View / Wire / Clip / Prune mode |
| Click on a coloured circle | Perform the current mode's action on that branch |

### Getting started

1. You begin in the shed with one starter juniper tree already on display.
2. Walk to the door marked "To Garden" and press E to enter the back garden.
3. Find a juniper bush (juniper is the only species that accepts cuttings at the moment — maple and pine can only be grown from seed, which isn't implemented yet).
4. Press E on the bush to take a cutting. Each bush gives 3 cuttings before needing two weeks to recover.
5. Return to the shed through the "Back to Shed" door.
6. Walk to the planting table, press E to open the planting panel. Select your cutting, click "Plant Cutting."
7. A new tree sprite appears. Press E on it to open the inspector.
8. Water it, skip days to grow it, clip or prune its branches, and click "Inspect 3D" to see it in 3D.

## Game mechanics

### Trees

Each tree has a **species** (juniper, maple, pine), an **age** in simulated days, **vitality** (how healthy it is, 0-100), **vigor** (growth speed, 0-100), and a **water level**. Trees also have a complete morphological record: trunk height and girth, a list of branches (each with its own angle, length, girth, and bend), and a history of every training operation performed on them. All of this drives the 3D mesh.

### Time

Time passes in **game days**. One real minute is roughly one game day by default. Trees simulate silently in the background — their water level drops, their vitality responds, they sometimes sprout new branches. You can also spend fertilizer to skip time for a specific tree, letting you grow one tree quickly without fast-forwarding the rest of the world.

### The growth loop

1. **Water** trees regularly. Dry trees lose vitality. Overwatered trees lose less but still suffer mild damage.
2. A healthy, well-watered tree will slowly sprout new branches and gain height and trunk girth over time.
3. **Vigor** accelerates growth. It's currently fixed at 50 but will eventually respond to fertilizer, pot size, and repotting.
4. **Vitality** governs everything — a weak tree grows slower and is more fragile to aggressive training.

### Propagation

- **Cutting:** Take a small branch from an existing plant, plant it in a pot. Starts as an 8cm twig with two small side branches. Not all species accept cuttings — junipers do, maples don't.
- **Seed:** Not yet implemented. Will allow growing species that can't be cut. Starts as a 2cm sprout.

### Training — what each operation does

Training is what separates a growing plant from a *bonsai*. The art of bonsai is directing growth through careful, gradual manipulation. Each of these operations mutates the tree's morphology and is recorded in its training history — over time you build up a trained tree whose shape reflects your choices.

#### Water
Tops up the tree's water level to 100. Simple, cheap, no consequences.

#### Clip
**Shorten a branch by a small amount.** Clipping controls the length and density of a branch. Repeated clipping encourages the branch to thicken and sprout secondary growth near the cut — this is how the bushy, dense canopy of a mature bonsai is formed. Cost: nothing. Clipping removes a little foliage density each time.

#### Prune
**Remove a branch entirely.** Pruning is a bigger decision than clipping — you're committing to a tree without that branch forever (it'll never grow back in the same place). Pruning is used to remove branches that don't fit the intended style (a "formal upright" style typically wants branches only on certain sides; a "cascade" wants everything going downward). Cost: nothing monetary, but the tree loses significant foliage density and will take time to recover.

#### Wire
**Bend a branch into a new angle.** In real bonsai, wire is wrapped around a branch and the branch is gently bent into position; over many weeks, the branch "sets" in that position and the wire is removed. In this game, clicking wire mode applies a 30° bend to the selected branch.

The tree remembers when each wire was applied. If you remove a wire after 8+ weeks of game time (56 days), the bend becomes permanent. If you remove it earlier, the branch springs back partway. (Wire removal isn't hooked up to a UI yet — wires stay applied for now.)

**Important:** wiring a branch that's too thick for the bend angle causes damage. The thicker the branch, the gentler the bend has to be. This is realistic — in real bonsai, a thick branch bent too hard will snap or split.

### Pots and resources

- **Clay** is used at the workbench to make pots.
- **Pots** are needed to plant cuttings. Each cutting consumes one pot.
- **Fertilizer** is consumed when you skip time forward on a tree. Cost is roughly half a fertilizer per day skipped.
- **Wire** is in the inventory but not yet consumed by the wire operation — this will be hooked up in a future iteration.

### Saving

The game can save and load its entire state to JSON. Every tree, every branch, every training history entry, and the inventory are preserved. Press **F5** to save and **F9** to load. Saves are stored in GameMaker's default save location (`%LOCALAPPDATA%\BonsaiGame\save1.json` on Windows).

## Credits

Built collaboratively with **Claude** (Anthropic), who did a lot of the initial heavy lifting on architecture, design decisions, and code — from the data model and growth simulation through to the procedural 3D tree pipeline. Thanks Claude.

## License

Released under the MIT License. See [LICENSE](LICENSE) for the full text.
