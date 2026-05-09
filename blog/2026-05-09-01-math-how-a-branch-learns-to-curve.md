# [Math] How a Branch Learns to Curve

*Fourth post in the math sub-series, the sequel to last week's trunk-bending post. Same audience: high school, early uni, anyone happy to look at a closed-form integral if I show my work. The previous post promised this one would be about why the wired branches still look straight; that promise has expired in the time it took me to ship the fix, so this is the post about *how the fix works* instead. The maths is the cleaner cousin of the trunk maths — fewer moving parts, but the absence of those moving parts is itself the interesting bit.*

## Where we left off

A trunk in this game is bent by a list of "bend events": at each height up the trunk, deflect by 20° in some compass direction. The list might have one entry, or six, and they're applied in height order. The renderer walks up the trunk in segments, applying each event as the cumulative height passes it, integrating position from a parallel-transported tangent.

A branch is different. A branch carries one number — `branch.bend` — which the player wires by clicking a hotspot in the 3D viewer and picking an angle. There is no list. There is no "bend event 1, then bend event 2." The whole branch is described by:

- An attachment angle (where on the trunk it sticks out from)
- A length
- A girth
- A single bend scalar

When the player wires a branch, that bend scalar gets set. When they remove the wire while the branch is "young" (under 56 in-game days), it springs back to 30%. When the branch is older, it holds. None of that is a list; it's all one number.

For months, the renderer treated this number the simplest possible way:

```gml
var _dir_angle = _branch.angle + _branch.bend;

return vec3(
    _ox + dcos(_dir_angle) * _length_m * _t_along,
    _oy + dsin(_dir_angle) * _length_m * _t_along,
    _oz + _length_m * _t_along * 0.25
);
```

Take the attachment angle, add the bend angle, and use the result as the branch's *direction*. Then go in a straight line along that direction for the length of the branch. The branch's wire would visibly tip over to one side, but the branch itself was a stick. Bend the branch by 30° and the entire branch shoots off at 30° from where it joined the trunk — every part of it pointing the same way.

That's not how wire works in real life, and it's not what the player expects to see. A wired branch *curves*. The base stays where it was attached, and the tip swings around — but the middle is a smooth arc, not a kink at the attachment point.

## What we actually want

**Uniform curvature along the length.**

At the base of the branch (parameter `t = 0`), the direction should be `branch.angle` — the same direction the branch attached to the trunk. At the tip (`t = 1`), the direction should be `branch.angle + branch.bend`. In between, the direction sweeps linearly:

```
direction at parameter t = branch.angle + branch.bend × t
```

That's a tangent that rotates uniformly as you walk along the branch. The path it traces out is a circular arc. (Rotating tangent + uniform speed = circle. That's the definition of a circle.)

To draw this curve, we need positions along it. And here's where the maths gets interesting.

## Why a single scalar is easier than a list

Last week's trunk code had to walk up the trunk in segments, applying each event when the cumulative height passed it. The reason was that bend events came at *arbitrary* heights — you couldn't write a closed-form expression for "where is the trunk's centreline at height h" without summing up everything below h. Numerical integration was the only honest answer.

Branches don't have that constraint. The bend is *uniform along the length*. The angle as a function of arc-length parameter `s` is just:

```
angle(s) = a₀ + (bend / L) × s
```

where `a₀` is the attachment angle, `bend` is the total bend in degrees, and `L` is the branch's length. It's linear. And the integral of `cos(linear function)` is a thing maths classes spend three weeks practising.

## The integral

The horizontal position of a point at arc length `s` along the branch is:

```
x(s) = ∫₀ˢ cos(angle(u)) du
```

If `angle(u) = a₀ + κu` (where `κ = bend/L`, the *curvature*), then standard integration:

```
∫ cos(a₀ + κu) du = (1/κ) × sin(a₀ + κu) + C
```

Apply the limits 0 to s:

```
x(s) = (1/κ) × (sin(a₀ + κs) - sin(a₀))
     = (L/bend) × (sin(angle(s)) - sin(a₀))
```

For y, the same trick with sin/-cos:

```
y(s) = (L/bend) × (-cos(angle(s)) + cos(a₀))
```

(Both with a `180/π` factor when bend is in degrees and we're integrating in degree units, but the structure is the same.)

That's the entire position function. No loops, no segments, no integration in code — the maths textbook hands you the answer and you copy it down.

## A worked example

Branch with `a₀ = 0°` (pointing east), `bend = 30°`, `L = 1`. Where is the tip?

`angle(s=L) = 0° + 30° = 30°`. So:

```
x(L) = (1 / 30°) × (sin(30°) - sin(0°)) × (180/π)
     = (1 / 30) × (0.5 - 0) × 57.296
     = 0.955

y(L) = (1 / 30°) × (-cos(30°) + cos(0°)) × (180/π)
     = (1 / 30) × (-0.866 + 1) × 57.296
     = 0.256
```

The tip is at `(0.955, 0.256)`. The straight-line distance from the base is `√(0.955² + 0.256²) = 0.989`. Slightly less than 1, because the curve is *longer* than the chord between its endpoints. That's geometry telling you the branch arc'd: a curve from (0,0) to (0.955, 0.256) of length 1 *must* be curved.

For `bend = 60°`, the tip ends up at `(0.827, 0.477)`, chord length `0.955`. More bend → tip swings further around → chord is shorter than the arc. As `bend → 360°`, the branch is curling around to where it started, and the chord shrinks toward zero.

For `bend = 0`, the formula breaks (division by zero). You can either special-case it as a straight line, or take the limit (and get the same answer). The code special-cases:

```gml
if (abs(_branch.bend) < 0.001) {
    _hx = _length_m * _t_along * _ca0;
    _hy = _length_m * _t_along * _sa0;
} else {
    var _angle_t = _branch.angle + _branch.bend * _t_along;
    var _scale   = (_length_m / _branch.bend) * (180 / pi);
    _hx = _scale * (dsin(_angle_t) - dsin(_branch.angle));
    _hy = _scale * (-dcos(_angle_t) + dcos(_branch.angle));
}
```

Six lines of substance. The branch's whole horizontal silhouette comes from those six lines.

## The frame, but cheaper

Last week's trunk code had to walk a frame `(T, N, B)` up the trunk segment by segment, applying Rodrigues rotation at each step to keep the basis vectors mutually perpendicular through the bends. It was iterative because the bends came at unpredictable points.

For a branch, the frame at parameter `t` is *also* closed form. The tangent rotates uniformly around `+z` (since branch bending happens in the horizontal plane), so:

```
T(t) = (cos(angle(t)), sin(angle(t)), 0.25) / √1.0625
N(t) = (-sin(angle(t)), cos(angle(t)), 0)
B(t) = T × N
```

Where the `0.25` is a small constant z-lift (branches grow slightly upward in the game; it's a stylistic choice that pre-dated this rewrite) and the `√1.0625` normalises the un-normalised tangent. `N(t)` is "horizontal right of the tangent." `B(t)` falls out of the cross product.

No iteration. No Rodrigues. No "apply the rotation, then store the result." Each component of each vector is a direct expression in `angle(t)`. Walking the branch and rotating the frame are the *same operation expressed differently* — and once you've expressed it as an algebraic formula, the loop disappears.

This is one of those moments where a constraint you expected to make life harder (only one bend scalar) actually makes life easier. The trunk's "list of events" gave the player flexibility but cost the renderer a discrete walk. The branch's "single scalar" gives the player less direct control but lets the renderer hand the maths off to algebra.

(There's a deeper version of this lesson in physics. *The action principle*. The Hamiltonian. Phenomena that look procedural — particles bouncing around, fields evolving — turn out to be governed by extremising a single integral. The procedural description and the variational description are equivalent, but the variational one is often where the elegant solutions hide. It's nice when game maths bumps into the same lesson.)

## The wire coil also needs to know

A wired branch in the game shows a copper helix wrapped around it. Before this rewrite, the helix code computed a single forward direction (the constant `angle + bend`) and built its rings perpendicular to that one vector for the whole branch.

That doesn't work anymore. The branch's local tangent now rotates as you walk along it. If the helix uses a constant forward, the rings near the tip point in the wrong direction — they line up with the bent-tip direction, not the local tangent. The coil floats off the branch at the tip.

The fix is small: at each helix sample, look up the branch's local frame and use *that* tangent + that local right/up basis:

```gml
for (var i = 0; i <= _segs; i++) {
    var _s = i / _segs;
    var _f = branch_frame_at(_tree, _branch, _s);

    // Wrap the helix around the branch using f.normal/f.binormal as the
    // ring's basis, with the helix sweep angle picking the spot on the ring.
    var _centre = vec3(
        _f.pos.x + (cos(theta) * _f.normal.x + sin(theta) * _f.binormal.x) * _offset,
        ...
    );
    ...
}
```

The helix now follows the branch. Same code structure as the trunk wire anchor (which already used trunk frames). The mesh pipeline gets one frame helper per part of the tree it draws, and each draw pass asks for what it needs.

## What this enables

The most obvious win is that wired branches look like they've been wired. Click a branch hotspot, pick a bend angle, and the branch curves. Click again to wire it harder, and the curve gets more dramatic. The wire coil tracks the curve. The foliage cluster at the tip ends up where the tip *actually is*, not where a straight extrapolation would put it.

But there's a quieter win. Last week's trunk fix unlocked three style-conformance scores that had been stubbed out for months — the morphology had been there but the renderer wasn't really *using* it as a curve. This week's branch fix doesn't unlock any new scoring (no criterion currently reads `branch.bend`), but it does close the loop on the visible-vs-scored gap: the wired branches the player sees are now the same wired branches the scorer evaluates if I ever add a "branch elegance" criterion. The plumbing is in place for the day that becomes interesting.

Six lines of integral. Three components of a frame, each computed by direct rotation formula. One small loop change in the wire coil. That's the whole change.

Closed-form solutions feel like cheating sometimes — like the answer was hiding in plain sight and you spent weeks not seeing it because you were distracted by all the more general cases that *did* need a loop. But the trunk needed a loop. The branch didn't. You learn to ask "is this the case where I get to skip the loop?" early, and it pays off when the answer is yes.

---

## Coming next

The next post takes a step back: *the 3D viewer is mostly arithmetic*. A walking tour of every kind of maths the viewer uses — trig, vectors, dot/cross products, projection matrices, parametric curves — with one paragraph of teaser per topic, anchored in screenshots. Less worked example, more "here's the map of the country we've been touring." Sets up the deeper dives that follow.

After that, *where does branch 3 actually start?* — the trunk-attachment maths I've now skipped over twice. The branch base is computed in the trunk's local frame (now that the trunk has one), so a branch on a leaning trunk attaches to the right spot on the bark even when the trunk is tilted. It's the bridge between "circle in the abstract" and "circle as the cross-section of a moving thing whose orientation matters."
