# Bonsai Greenhouse

A cozy simulation game where you grow, shape, and care for bonsai trees. Take cuttings from plants in your garden, pot them up in your shed, train them with wire and clippers over the course of many simulated days, and watch them take shape in a 3D viewer.

Play the current build at **https://bonsai.silly.ninja** (installable as a PWA; every merge to `main` deploys there). Built as an installable **web game** in TypeScript (Vite, Phaser, Three.js). It began life as a GameMaker prototype, which is preserved whole in [`archive/gamemaker/`](./archive/gamemaker/); the decision to rewrite is recorded in [`docs/ADR-001-typescript-rewrite.md`](./docs/ADR-001-typescript-rewrite.md).

## About this repo

This is a personal experiment in AI-assisted game development, developed autonomously: a controlling agent plans and builds, and Drew steers through decisions and reviews. Most of the architecture, simulation, and 3D pipeline code was built collaboratively with Claude (Anthropic). It's a sibling to [the-library](https://github.com/N3rdage/the-library), a similar experiment with a different interaction style and a very different project (a book-tracking web app in .NET / Blazor).

There's a running dev blog in [`blog/`](./blog) written by Claude in first person. If you're here for the AI-collaboration angle more than the game itself, start there.

**Contributions:** suggestions are welcome via the discussion channels linked from the blog. External pull requests are not being accepted at this stage.

## Status

**Playable.** The web build has reached parity with the prototype. Play it at **https://bonsai.silly.ninja** in a browser, on a desktop or a phone, and install it from there as a PWA. From the title you start a new game or continue a save; in the game you walk the shed, the back garden, the house (the lounge, the hallway and the study) and the glass greenhouse through the garden's top fence, water, fertilise and skip time on trees in the inspector, wire, clip and prune them in the 3D viewer, take juniper cuttings, make pots at the workbench, plant cuttings at the planting table, buy supplies at the shop (a bicycle in the front garden goes there), display and sell trees, follow Granny's tutorial and notebook, and save to one of three slots kept in the browser. Pedestals and floor shelves are bought at the shop (a pedestal for $30, a floor shelf for $50), and a new game starts with one pedestal; P (or Menu → Place item) in the greenhouse puts them down, where they display trees like the house's spots, and an empty one is picked back up by interacting with it empty-handed.

On a keyboard: arrows or WASD to move, E to interact, V to open the 3D viewer, J for the notebook, Z to sleep a day, P to place furniture in the greenhouse, F5 and F9 to save and load, and Esc or Q to close a panel (Q is the key that still works in browser fullscreen, where the browser keeps the first Esc) and Esc to go back to the title; on the title, Enter, C, L and S pick New Game, Continue, Load Game and Settings. On a touchscreen: press and drag anywhere in the room to move (an on-screen joystick that starts where you press), and tap the HUD buttons (Interact, View tree, Notebook, Menu) and the rows of each panel; the HUD and menu labels and the tutorial text name no keys there (`Notebook`, `View tree`, `Interact`, `Close`), the tutorial box shrinks to its step title with Skip and More on a short screen (a phone in landscape with the browser bars showing), More opening it out to the full text, the title's buttons are tappable too, and the 3D viewer has its own toolbar for its modes, the wire controls, zoom, reset and Exit. The full tables are under [Controls](#controls).

The GameMaker prototype in [`archive/gamemaker/`](./archive/gamemaker/) is kept whole and frozen as the reference the port was built from; it is not the game you play.

The gameplay, controls and mechanics below describe the web build.

## Developing

Requires Node 22 (see `.nvmrc`).

```
npm ci              # install
npm run dev         # dev server with hot reload
npm run check       # lint, format, typecheck, unit tests, build
npm run test:e2e    # browser tests against the production build (run npm run build first)
```

Every pull request runs the same checks in CI and deploys a preview to Azure Static Web Apps.

The title screen's corner shows which build you are playing, for example `v2026.11.10.142 (6d2152e)`: the UTC date of the commit it was built from, the CI run number (`0` for a local build) and the short commit SHA; tap it to open that commit on GitHub.

## Playing

### Controls

On a phone the game runs fullscreen in landscape: the first tap on New Game, Continue or Load goes fullscreen where the browser allows it, and holding the phone upright shows a "Rotate your phone" prompt over the paused game.

The game has sound effects and quiet ambient music, each with its own switch in Settings (from the Menu or the title). Each place has its own loop, cross-faded as you go through a door: the shed, the garden, the house (one loop for its three rooms) and the 3D viewer. The title plays no music, and the music pauses with the game under the rotate prompt.

| Input | Action |
|-------|--------|
| Drag anywhere (joystick) or WASD / arrows | Move player |
| 3D world (Settings): Q and E, mouse drag or a finger on the right half of the screen, wheel or pinch | Turn the camera round the player in steps, turn it freely, and zoom; movement follows the camera, so up and the stick's up walk away from it; walls between the camera and the room drop to a skirting (on a touchscreen a finger on the left half is the joystick and one on the right turns the camera; two fingers anywhere are a pinch that only zooms, and the zoom is kept from room to room) |
| 3D world (Settings): tap or click | A tap on a door, furniture or prop walks the player there and uses it, as Interact would on arrival; a tap on bare floor walks there. A press that moves more than a few pixels or is held a moment is a drag that turns the camera, never a tap; a key or the stick takes the walk back, and the Interact prompt shows above the Interact button |
| 3D world (Settings): Interact at the lounge's sofa or armchair | Sit on it, facing out; any move, a tap on the floor or Interact again gets up. Purely for show |
| 3D world (Settings): walk into a doorway | Walking toward a door takes you through it with no Interact press; walking along its wall past it does not |
| Interact button or E | Interact with the nearest object |
| Interact on a tree (or its pedestal) | Open the tree inspector: stats, score breakdown, Water, Fertilise, Skip 7d, Pick up, View in 3D |
| Inspector: Rename, Set Style, Sell, Repot | Open the sub-panel: type a name (Enter saves), tap a style, confirm the sale price, or pick a standard or fancy pot (spring, 60 days after the last repot) |
| Inspector → Pick up, or Interact on an empty pedestal → Place | Carry a tree (one at a time) and display it on an empty pedestal |
| Menu button → Put down (while carrying) | Put the carried tree down on the floor of the room you are in |
| Menu button → Place item, or P (in the greenhouse) | Place furniture: a ghost of the pedestal or floor shelf from your inventory shows on the tile you face, green where it fits; E or Interact puts it down, P or Menu → Next switches to the other kind, Esc, Q or Menu → Stop placing cancels |
| Inspector → View in 3D | Open the 3D viewer on that tree |
| View tree button or V | Open the 3D viewer on the first tree |
| Notebook button or J | Open or close Granny's notebook: one page per tutorial step, Prev and Next to turn |
| Menu button → Inventory, or I | Open or close the inventory: resources, seeds and cuttings with their counts |
| Menu button → Sleep, or Z | Sleep until the next morning: the whole world advances one day, as if the clock had run |
| Menu button → Sleep a week | Sleep through seven days, waking on the seventh morning |
| Tutorial panel → Skip | Skip the tutorial (asks first) |
| Tutorial panel → More / Less | On a short touch screen, open the compact box out to its full text, or fold it back |
| Menu button → Save, or F5 | Save game |
| Menu button → Load, or F9 | Load game |
| Menu button → Benchmark (while the 3D world is on) | Fly the camera round the room for 14 seconds, then show the frame rate, median, p95 and worst frame times and draw calls; Close puts the panel away and the camera goes back to the player |
| Menu button → Room times (while the 3D world is on) | Show how long the latest room changes and the rooms built ahead of them took, in milliseconds; Close puts the panel away |
| Menu button → Title, or Esc | Back to title (Esc first closes an open panel or the 3D viewer, or ends placing) |
| Q | Close an open panel, the 3D viewer or placing mode, and nothing else: it never leaves the room, and in the rename box it is a typed letter. Unlike Esc it works in browser fullscreen, where the browser takes the first Esc to leave fullscreen; there the close buttons name Q, not Esc (Chromium offers Esc back through its keyboard lock, and then they name Esc again) |

**In the 3D viewer:**

| Input | Action |
|-------|--------|
| Drag (mouse or one finger) | Orbit camera |
| Pinch, scroll wheel, or the + / − buttons | Zoom |
| Reset button or R | Reset camera |
| V / W / C / P, or the toolbar's mode buttons | Switch to View / Wire / Clip / Prune mode |
| Click or tap a numbered hotspot | Perform the current mode's action on that branch or trunk point |
| Exit button, Esc or Q | Close the viewer |

### Getting started

1. You begin in the shed with Granny's juniper on the floor; the tutorial panel in the corner walks you through the first steps.
2. Walk to the door marked "To Garden" and press E (or tap Interact) to enter the back garden.
3. Find a juniper bush (juniper is the only species that accepts cuttings at the moment — maple and pine can only be grown from seed). Cuttings can be taken in spring and summer only; in autumn the same plants give seeds (Take Seeds), and the shop sells seed packets all year.
4. Press E on the bush to take a cutting. Each bush gives 3 cuttings before needing two weeks to recover.
5. Return to the shed through the "Back to Shed" door.
6. Walk to the planting table, press E to open the planting panel. Select your cutting, click "Plant Cutting." (The panel also lists the juniper and maple seed you start with; select one and click "Plant Seed" to sow it.)
7. A new tree sprite appears. Press E on it to open the inspector.
8. Water it, use Skip 7d to grow it a week, and use View in 3D to see it in 3D and wire, clip or (in winter) prune its branches.
9. To show a tree off, pick it up in the inspector and place it on a display pedestal: two stand in the lounge, through the shed's top door marked "To Lounge", and two in the study, through the lounge's right-hand door to the hallway and on through its far door.

## Game mechanics

### Trees

Each tree has a **species** (juniper, maple, pine), an **age** in simulated days, **vitality** (how healthy it is, 0-100), **vigor** (growth speed, 0-100), and a **water level**. Trees also have a complete morphological record: trunk height and girth, a list of branches (each with its own angle, length, girth, and bend), and a history of every training operation performed on them. All of this drives the 3D mesh. Species look different too: a juniper has brown bark and small scale-leaf sprays, a maple smooth grey bark and broad leaves, a pine dark bark and narrow needle tufts, in the 3D viewer and in the room's tree sprite.

### Time

Time passes in **game days**. One game day passes every fifteen real minutes (Settings, Time speed, runs the clock at 2x or 4x, and a small line under the status box names the phase of the day), and the clock stops while the 3D viewer is open. Each day runs from morning through dawn, day, dusk and night, and the time of day is saved with the game; it changes nothing about growth, watering or revenue, which happen once a day as the day turns over at morning. Trees simulate silently in the background — their water level drops, their vitality responds, they sometimes sprout new branches. **Sleep** (Z, or Menu → Sleep; Menu → Sleep a week for seven) sleeps until the next morning, moving the whole world on a day at a time exactly as the clock would: every tree drinks, grows and ages, displayed trees earn their revenue, and nothing is charged for the sleep itself. You can also spend fertilizer to skip time for a specific tree, letting you grow one tree quickly without fast-forwarding the rest of the world.

### The growth loop

1. **Water** trees regularly. Dry trees lose vitality. Overwatered trees lose less but still suffer mild damage.
2. A healthy, well-watered tree will slowly sprout new branches and gain height and trunk girth over time.
3. **Vigor** accelerates growth. It starts at 50 and slowly falls as the pot ages (more slowly in premium soil); repotting resets it to 50.
4. **Vitality** governs everything — a weak tree grows slower and is more fragile to aggressive training.

### Propagation

- **Cutting:** Take a small branch from an existing plant, plant it in a pot. Starts as an 8cm twig with two small side branches. Not all species accept cuttings — junipers do, maples don't.
- **Seed:** Plant a seed from your inventory at the planting table, in a pot. Starts as a 2cm sprout with no branches. Grows species that can't be cut, such as the Japanese maple. A new game starts with one juniper and one maple seed. More come from the garden's plants in autumn (Take Seeds, one at a time, up to three before the plant needs two weeks to recover, shared with cuttings) or from the shop as $9 packets of juniper, maple or pine, all year.

### Training — what each operation does

Training is what separates a growing plant from a *bonsai*. The art of bonsai is directing growth through careful, gradual manipulation. Each of these operations mutates the tree's morphology and is recorded in its training history — over time you build up a trained tree whose shape reflects your choices.

#### Water
Tops up the tree's water level to 100. Simple, cheap, no consequences.

#### Clip
**Shorten a branch by a small amount.** Clipping controls the length and density of a branch. Repeated clipping encourages the branch to thicken and sprout secondary growth near the cut — this is how the bushy, dense canopy of a mature bonsai is formed. Cost: nothing. Clipping removes a little foliage density each time.

#### Prune
**Remove a branch entirely.** Pruning is a bigger decision than clipping — you're committing to a tree without that branch forever (it'll never grow back in the same place). Pruning is used to remove branches that don't fit the intended style (a "formal upright" style typically wants branches only on certain sides; a "cascade" wants everything going downward). Cost: nothing monetary, but the tree loses significant foliage density and will take time to recover. Pruning is done in winter only; in the other seasons Prune mode says `Prune: requires winter` and leaves the tree alone. Clipping works all year.

#### Wire
**Bend a branch into a new angle.** In real bonsai, wire is wrapped around a branch and the branch is gently bent into position; over many weeks, the branch "sets" in that position and the wire is removed. In this game, each click on a branch in wire mode bends it 15° in the chosen direction (20° on the trunk) and uses one wire.

The tree remembers when each wire was applied. If you remove a wire after 8+ weeks of game time (56 days), the bend becomes permanent. If you remove it earlier, the branch springs back partway. Wire mode's Remove action takes a wire off, after asking first.

**Important:** wiring a branch that's too thick for the bend angle causes damage. The thicker the branch, the gentler the bend has to be. This is realistic — in real bonsai, a thick branch bent too hard will snap or split.

### Pots and resources

- **Pots** are needed to plant cuttings and seeds. Each one planted consumes one pot.
- **Pots** are needed to plant cuttings. Each cutting consumes one pot.
- **Fertilizer** is consumed when you skip time forward on a tree. Cost is roughly half a fertilizer per day skipped.
- **Wire** is used up by each bend in the 3D viewer's wire mode.
- The **shop**, reached from the bicycle in the front garden (E: Go to the shop), sells clay, pots, wire, fertilizer, fancy pots, premium soil, seed packets, and furniture for the greenhouse: pedestals ($30) and floor shelves ($50).

### Saving

The game can save and load its entire state to JSON. Every tree, every branch, every training history entry, and the inventory are preserved. Press **F5** (or Menu → Save) to save and **F9** (or Menu → Load) to load; the three save slots live in the browser's local storage. The save format reads the prototype's `saveN.json` files through a one-way importer, though the game has no button to bring such a file in.

## Credits

Built collaboratively with **Claude** (Anthropic), who did a lot of the initial heavy lifting on architecture, design decisions, and code — from the data model and growth simulation through to the procedural 3D tree pipeline. Thanks Claude.

The player's body in the 3D world is the Rogue from "KayKit: Adventurers Character Pack 2.0" and its clips come from "KayKit: Character Animations 1.1", both by Kay Lousberg (www.kaylousberg.com), released under CC0. The licence text is in [src/world3d/player/LICENSE-KayKit.txt](src/world3d/player/LICENSE-KayKit.txt).

The lounge's side table, sofa, armchair, coffee table and floor lamp and the study's desk and low bookcase, and the hallway's runner rug in the 3D world are models from "KayKit: Furniture Bits 1.0", also by Kay Lousberg, released under CC0. The licence text is in [src/world3d/furniture/LICENSE-KayKit-Furniture.txt](src/world3d/furniture/LICENSE-KayKit-Furniture.txt).

The lounge's kitchen counters, with their sink, stove and corner, in the 3D world are models from "KayKit: Restaurant Bits 1.0", also by Kay Lousberg, released under CC0. The licence text is in [src/world3d/restaurant/LICENSE-KayKit-Restaurant.txt](src/world3d/restaurant/LICENSE-KayKit-Restaurant.txt).

## License

Released under the MIT License. See [LICENSE](LICENSE) for the full text.
