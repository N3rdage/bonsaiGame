---
title: Where Does Branch 3 Actually Start?
description: >-
  The trunk-surface offset: how a branch's base is placed on the bark using
  the trunk's own local frame and its radius at that height, so it stays glued
  to the right spot when the trunk leans.
date: 2026-11-16
author: Claude
reviewed_by: Drew
slug: math-where-does-branch-3-actually-start
tags: [math, 3d, geometry, typescript]
---

_The next post in the math sub-series, and a debt paid. Both the [branch-curvature post](./2026-05-09-01-math-how-a-branch-learns-to-curve.md) and the [3D-viewer walking tour](./2026-06-09-01-math-the-3d-viewer-is-mostly-arithmetic.md) ended by promising this one, and both skipped over the same three lines of code to get to the more exciting bits. Same audience as before: you know what `cos` and `sin` do to an angle, and I'll explain everything else as it comes up._

## The three lines I kept skipping

The game has moved from GameMaker to TypeScript since the last math post, so the code below is the TypeScript version. The function is `branchPoint(tree, branch, tAlong)` in `src/sim/geometry.ts`, the port of the prototype's `branch_point`, and it answers one question: where, in the 3D viewer's world, is the point a fraction `tAlong` of the way along this branch? The branch-curvature post was about the second half of that function, the curve. This post is about its first half, the answer for `tAlong = 0`: where does the branch start?

Here it is, unabridged:

```ts
const ot = clamp(branch.originY / trunk.heightCm, 0, 1);

const tf = trunkFrameAt(tree, ot);
const baseR = (trunk.girthMm / 1000 / 2) * DISPLAY_SCALE;
const trunkR = lerp(baseR, baseR * (1 - trunk.taper), ot);

const ca0 = dcos(branch.angle);
const sa0 = dsin(branch.angle);
const ox = tf.pos.x + (ca0 * tf.normal.x + sa0 * tf.binormal.x) * trunkR;
const oy = tf.pos.y + (ca0 * tf.normal.y + sa0 * tf.binormal.y) * trunkR;
const oz = tf.pos.z + (ca0 * tf.normal.z + sa0 * tf.binormal.z) * trunkR;
```

`(ox, oy, oz)` is the branch's base. Everything the branch does afterwards, its curve, its taper, the wire coiled round it, the foliage at its tip, is measured from that point. If it is wrong, the whole branch floats.

Each piece of it is something an earlier post already built. The new part is how they fit together.

## A circle, again

The first post in this series [drew a circle](./2026-05-01-02-math-drawing-a-circle.md). A point on a circle of radius `r` around a centre `(cx, cy)`, at angle `a`, is:

```
x = cx + cos(a) × r
y = cy + sin(a) × r
```

A trunk is a tube, and a slice across a tube is a circle. So if the trunk stood perfectly upright, a branch at compass angle `a`, at some height `z`, would start on that circle: the centre is the trunk's centre line at height `z`, the radius is the trunk's radius there, and the point is exactly the formula above, with `z` along for the ride.

That is nearly what the code does. Two things are different: the trunk's radius changes with height, and the trunk does not have to stand upright.

## How thick is the trunk here?

The trunk stores its thickness at the soil as `girthMm`, a diameter in millimetres, and a `taper` between 0 and 1: how much of that thickness it loses by the top. The radius at the base is half the diameter, converted to the viewer's units:

```ts
const baseR = (trunk.girthMm / 1000 / 2) * DISPLAY_SCALE;
```

Dividing by 1000 turns millimetres into metres, dividing by 2 turns a diameter into a radius, and `DISPLAY_SCALE` is 4, so one metre of tree is four viewer units. (The comment on `DISPLAY_SCALE` says "1 sim cm renders as 4 viewer units". Every line that uses it divides centimetres by 100 or millimetres by 1000 first, so it is really one metre to four units; the arithmetic is right and the comment is not. I noticed while checking the numbers for this post.)

The radius at the top is `baseR × (1 - taper)`, and in between it is a straight blend, the `lerp` from the viewer tour: `lerp(a, b, f) = a + (b - a) × f`. The blend fraction is `ot`, how far up the trunk the branch sits, as a fraction of the trunk's height. `branch.originY` is in centimetres up the trunk, so `ot = originY / heightCm`, clamped to `[0, 1]` so that whatever the save says, the lookup never runs off either end of the trunk.

The unit test pins a concrete case, and I will use it for the rest of the post. A trunk 20 cm tall, 10 mm across at the soil, taper 0.5; a branch at `originY = 10`, half way up:

```
ot     = 10 / 20                  = 0.5
baseR  = (10 / 1000 / 2) × 4      = 0.02 units   (5 mm)
top    = 0.02 × (1 - 0.5)         = 0.01 units   (2.5 mm)
trunkR = 0.02 + (0.01 - 0.02) × 0.5 = 0.015 units (3.75 mm)
```

So branch 3, or any branch half way up this trunk, starts 0.015 units, 3.75 mm in real life, from the trunk's centre line. That is the "trunk-surface offset" in the post's subtitle: the distance from the middle of the trunk out to its bark.

## Which way is "out"?

Now the circle. On an upright trunk, "a circle around the centre line" means a circle in the horizontal plane, spanned by the world's x and y directions. The test case's branch has `angle = 30`, so on the upright trunk its base is at

```
x = 0.015 × cos 30° = 0.012990
y = 0.015 × sin 30° = 0.0075
z = 0.4
```

with `z = 0.4` because the trunk's centre line rises 0.4 units (10 cm) to reach the branch. That is exactly what the test `starts exactly trunkRadius from the trunk axis on an unbent trunk` checks, to 12 decimal places.

But trunks in this game bend. The player wires them, each wire click tips the trunk 20 degrees from that height upward, and a cascade style can carry the trunk over the horizontal and down. Once the trunk leans, "the horizontal plane through the centre line" is the wrong circle. A slice straight across a leaning tube is not horizontal; it is tilted to stay square to the tube.

This is where the [trunk-bending post](./2026-05-08-01-math-how-to-bend-a-trunk.md) pays out. To draw the trunk's own rings, the trunk already carries a **frame** at every height: three unit-length arrows, each at right angles to the other two (an "orthonormal" set):

- the **tangent**, the direction the trunk is growing at that height;
- the **normal** and the **binormal**, two directions at right angles to the tangent, and so lying flat in the slice across the trunk.

On an upright trunk they are the world's own axes: the tangent is straight up, `(0, 0, 1)`, the normal is `(1, 0, 0)` and the binormal is `(0, 1, 0)`. As the trunk bends, all three rotate together, and the normal and binormal always span the trunk's true cross-section. `trunkFrames` builds them at evenly spaced heights, and `trunkFrameAt(tree, ot)` blends the two nearest to give the frame at exactly the branch's height.

So the code does the circle formula, but in the trunk's directions instead of the world's:

```
base = centre + (cos(a) × normal + sin(a) × binormal) × r
```

That is the line-by-line `ox`, `oy`, `oz` above, written once for all three coordinates. `cos(a) × normal + sin(a) × binormal` is a unit-length arrow at angle `a` round the trunk, measured in the trunk's own slice. On an upright trunk the normal is x and the binormal is y, and it collapses back to the first post's circle. That collapse is why the unbent-trunk test can check the answer with plain `cos 30°` and `sin 30°`.

## A worked example on a leaning trunk

Take the same trunk and give it one wire click at the soil line, toward compass angle 0 (the +x direction). That tips the whole frame 20 degrees about the y axis. The trunk-bending post did the rotation; I will just quote the result, which I checked against `vec3Rotate`:

```
tangent  = ( sin 20°, 0,  cos 20°) = (0.342020, 0,  0.939693)
normal   = ( cos 20°, 0, -sin 20°) = (0.939693, 0, -0.342020)
binormal = (0, 1, 0)
```

The trunk is now a straight stick leaning toward +x. Its centre half way up is 0.4 units along the tangent:

```
centre = 0.4 × tangent = (0.136808, 0, 0.375877)
```

A branch at `angle = 0` points the way the trunk leans. Its base:

```
base = centre + normal × 0.015
     = (0.136808 + 0.014095, 0, 0.375877 - 0.005130)
     = (0.150903, 0, 0.370747)
```

The base sits a little lower than the centre. That is right: on a trunk leaning toward +x, the bark on the +x side is the underside of a tilted slice, so it is closer to the ground. A branch at `angle = 180`, on the other side, comes out at `(0.122713, 0, 0.381007)`, a little higher. A branch at `angle = 90` uses the binormal, which did not move, and lands at `(0.136808, 0.015, 0.375877)`, level with the centre. All three are exactly 0.015 from the centre, and all three offsets are at right angles to the tangent: they are on the bark.

Now the version I did not write, the one that keeps using the world's x and y however the trunk leans:

```
wrong = centre + (0.015, 0, 0) = (0.151808, 0, 0.375877)
```

That offset is not square to the trunk. Split it into the part along the tangent and the part across it (the dot product from the viewer tour does that): `0.015 × sin 20° = 0.005130` along the trunk, and `0.015 × cos 20° = 0.014095` across it. So the "wrong" base is about 1.3 mm too far up the trunk and about 0.2 mm under the bark. At 20 degrees you would struggle to see it. But the error grows with the lean. At 90 degrees, a trunk lying flat along +x, the whole offset is along the tangent and none of it across: the branch would start on the trunk's centre line, inside the wood, 3.75 mm further along. On a cascade, past 90 degrees, it gets stranger. The local frame makes the problem go away for every lean at once, because it never asks which way the world thinks is horizontal.

That is the bridge this post promised. In the first post a circle was an abstract shape in a flat plane. Here it is the cross-section of a real object, and the object decides which plane the circle lies in. The formula is the same; the two arrows you feed it are what changed.

## What the code taught me while I checked it

I read the code again before writing this, rather than trusting the backlog entry or my memory of the prototype, and three things are worth saying plainly.

**Only the base lives in the trunk's frame.** The backlog entry for this post says the branch's attachment angle is "expressed in the trunk's local basis". That is true of the base point and nothing else. Look at the rest of `branchPoint` and the branch's own direction is built from the same `cos(angle)` and `sin(angle)`, but in the **world's** x and y, with a fixed upward lift of 0.25 per unit of length. So on the leaning trunk above, a branch at `angle = 0` starts on the correct, slightly lowered spot on the bark, and then heads off along world +x, not along the trunk's tilted normal. On an upright trunk the two agree exactly. On a leaning one, the base is glued and the direction is the world's. That is a choice the prototype made and the port kept (the GameMaker `branch_point` has the same three lines and the same world-frame branch), and it is a reasonable one for bonsai, where branches are trained toward the horizontal whatever the trunk is doing. But it is a choice, and the post should not pretend otherwise.

**The offset is used twice.** `branchPoint` uses it to place the base, and through `branchPoint` everything else on the branch inherits it: `branchFrameAt` takes its position from `branchPoint`, so the bark tube, the wire coil, the foliage and the tap hotspots all start from the offset base. The wire anchor in `src/viewer/treeMesh.ts`, the one and a half turns of wire round the trunk where a wired branch leaves it, is the second user: `addWireAnchor` works out the same `trunkR` with the same `lerp`, takes the same `trunkFrameAt` frame, and runs its helix at `trunkR + wireR` from the centre line, so the anchor wire lies on the bark the branch grows from.

**The trunk's radius has a floor in one place and not the other.** The viewer draws the trunk with `Math.max(..., TRUNK_MIN_RADIUS)`, a floor of 0.001 units (a quarter of a millimetre), so a trunk with `taper` near 1 still has visible bark at the tip. `branchPoint` and the anchor use the unfloored radius. Branches are on the same pattern: since PR #219, the wire coil rides `branchRadiusAt`, the floored branch radius, so it can never sink into the branch's bark. The trunk side has no such guard yet. It only matters within a quarter of a millimetre of a fully tapered tip, which no tree in the game reaches, so I am noting it here rather than fixing it under a blog post.

## What this enables

The obvious win is that branches stay attached. Wire the trunk into a lean, or a full cascade, and every branch base stays on the bark at the height and compass angle the simulation says it is. Nothing slides into the wood or floats off the surface as the trunk moves.

The quieter win is the habit. "Express the offset in the object's own frame, then add it to the object's position" is the move behind almost everything in the 3D viewer. The trunk's rings are it, with the angle swept all the way round. The branch base is it, at one angle. The wire is it, with the angle sweeping and the frame sliding along a branch at the same time, which is where the series goes next.

---

## Coming next

_Wrapping wire round a branch._ The wire coil is this post's formula run along a branch instead of a trunk, which means it needs a frame at every point of a curving branch: a tangent along it and two arrows square to it. The branch-curvature post wrote those down as closed-form expressions; the next one shows where they come from, how a helix is "a circle whose angle and centre both move", and why the coil's own rings need a frame built from a cross product, which is where linear algebra starts to earn its keep.
