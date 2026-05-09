# [Math] How to Bend a Trunk

*Third post in the math sub-series, this one a worked example. Same audience as before — high school, early uni, anyone who's ever wondered what those "do I really need this?" maths classes get used for. You should be roughly comfortable with `cos`/`sin` and willing to look at a 3D vector. Quick aside on order: the previous post promised "branch attachment" as the next entry, but I shipped a trunk-bending fix this week and writing about the maths while I'm still up to my elbows in it produces a better post than reconstructing it later. Branch attachment will land out of order. Sorry to anyone who clicked expecting it.*

## The problem

Bonsai is, fundamentally, a wire-bending hobby. You want a trunk that meanders, leans, or descends below the rim of its pot. The way you get there is by wrapping a piece of training wire around the trunk and applying force — the wire is stiff enough to hold the trunk in a new shape while the cells in the bark adapt and the new shape becomes permanent.

In the game, the player picks a height up the trunk and a direction, clicks, and a bend appears. The data structure looks like this:

```gml
trunk.movement = [
    { y: 5,  angle_deg: 90 },   // bend at 5cm up, pointing north
    { y: 12, angle_deg: 90 },   // another bend, same direction
    { y: 18, angle_deg: 0  },   // bend at 18cm up, pointing east
];
```

Each entry is a "bend event": *at this height up the trunk, deflect by some amount in this direction*. The total list describes the trunk's shape.

The job of the renderer is to turn that list into a 3D curve.

## What I was doing before

For months, the trunk-rendering code did this:

```gml
for (var i = 0; i <= _segments_tall; i++) {
    var _t = i / _segments_tall;
    var _z = _t * _height_m;

    var _cursor_x = 0;
    var _cursor_y = 0;
    for (var m = 0; m < array_length(_moves); m++) {
        var _mh = _moves[m].y / _trunk.height_cm;
        if (_mh <= _t) {
            var _strength = (_t - _mh) * 0.05;
            _cursor_x += dcos(_moves[m].angle_deg) * _strength;
            _cursor_y += dsin(_moves[m].angle_deg) * _strength;
        }
    }

    var _center = vec3(_cursor_x, _cursor_y, _z);
    // …draw a ring at _center…
}
```

Walk up the trunk in segments. At each segment, the height `z` is whatever fraction of the way up you are. Then for each bend event below the current height, push the trunk's centre sideways a little — `cos(angle) * strength` in x, `sin(angle) * strength` in y. Stack all those sideways pushes and you get a leaning trunk.

The problem isn't subtle: **a leaning trunk is not the same thing as a curving trunk.** This code shifts the trunk's centre laterally — the rings move, but they're still stacked vertically along z. The actual trunk *direction* never changes. The trunk goes straight up, just with a kink in the middle where the centre offset jumps.

For mild bends it looks vaguely OK. For dramatic bends it looks like a stack of pancakes someone has nudged with their elbow. And there's no way to make a cascade — a trunk that descends *below* its base — because z always increases monotonically.

The code was placeholder. I knew it was placeholder. It was on the TODO list for months under the heading "proper trunk-bending math."

## What a curve actually is, in code

A curve in 3D, expressed as code, is a list of positions. The trick is: each position is connected to the next by a *direction*. If you know where you are now and which way you're going, you know where you'll be in a moment.

That's literally how it works:

```
position_next = position + direction * step_size
```

If your direction stays constant, you walk in a straight line. If your direction *rotates* as you go, you walk along a curve.

So the question stops being "how do I bend a trunk?" and starts being "how do I rotate a direction?"

## Rotating a direction

The trunk starts at the base, pointing straight up. In our coordinate system that's the vector `(0, 0, 1)` — zero x, zero y, one unit up.

A bend event says: at this height, deflect by 20 degrees toward some compass direction. Concretely: take the current direction, and rotate it 20 degrees toward `(cos angle_deg, sin angle_deg, 0)` — a unit vector in the horizontal plane.

Rotating a vector around an axis by some angle is a thing that has a name: **Rodrigues' rotation formula**. The formula looks scary the first time you see it but it's just a recipe:

```
v_rotated = v·cos(θ) + (axis × v)·sin(θ) + axis·(axis · v)·(1 − cos(θ))
```

You give it three things: the vector you want to rotate (`v`), an axis to rotate around (a unit vector), and an angle (θ). It hands you back the rotated vector. The dot product (`·`) and cross product (`×`) are the standard 3D-vector operations.

The intuition: the first term keeps the part of `v` that's perpendicular to the axis but rotated by θ. The second term handles the swing. The third term keeps the part of `v` that lies *along* the axis unchanged (because rotating around an axis doesn't move points on it).

For a worked example: rotate the vector `(0, 0, 1)` (pointing up) by 20° around the axis `(0, 1, 0)` (the y-axis):

- `v = (0, 0, 1)`, `axis = (0, 1, 0)`, `θ = 20°`
- `axis · v = 0` (they're perpendicular, no overlap)
- `axis × v = (1, 0, 0)` (right-hand rule: y cross z gives x)
- `v · cos(20°) = (0, 0, 0.940)`
- `(axis × v) · sin(20°) = (0.342, 0, 0)`
- The third term is zero because of the dot product.
- Sum: `(0.342, 0, 0.940)`

That's a vector tilted 20° east of vertical. Which is exactly what we asked for.

Repeat the rotation five more times (six 20° steps) and you've tilted the original vector by 120°, well past horizontal — `(0.866, 0, −0.5)`. Tilted east AND now pointing slightly downward. That's the cascade case.

## The axis trap

The first version of my new code used the *current* trunk direction crossed with the bend direction as the rotation axis: `axis = T × d`. It seemed natural — that's the axis that takes T and rotates it toward d.

It worked for trunks tilted up to 90° from vertical. Past that, things broke. The bends started undoing themselves: tilt to 100°, apply another bend in the same direction, tilt comes back to 80°. A cascade was impossible.

Why? Because `T × d` flips sign when T crosses past d. Before T passes d, the cross product points one way around the axis. After, it points the *other* way. Rotating by a positive angle around the flipped axis swings you in the *opposite* rotational direction. The trunk literally bounces back from horizontal.

The fix is to pick an axis that's *fixed in world space* per bend event, not derived from the current direction. The world's "up" direction is `(0, 0, 1)`. The bend direction `d` is horizontal: `(cos angle_deg, sin angle_deg, 0)`. Their cross product is `(−sin angle_deg, cos angle_deg, 0)` — a horizontal axis perpendicular to `d`, never flipping no matter how much the trunk has already tilted.

```gml
var _ax = vec3(-dsin(_ev.angle_deg), dcos(_ev.angle_deg), 0);
_T = vec3_rotate(_T, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
```

Two lines. The first builds the fixed rotation axis. The second rotates the current tangent by 20° around it. With this pair, six 20° bends in the same direction produce a real cascade — the trunk swings past horizontal and continues curving down, exactly the way the maths says it should.

This is a recurring pattern in 3D code: things that *seem* equivalent (the axis the rotation goes around) turn out to behave differently in edge cases. The fix is almost never more code; it's swapping two cross-product factors.

## But the trunk has thickness

Knowing where the trunk's centre line goes is half the job. The trunk is also a tube — every height up the centre line, there's a ring of vertices around the bark at some radius.

A flat horizontal ring works fine when the trunk is vertical. As soon as the trunk tilts, you want the ring to tilt with it — perpendicular to the trunk's direction, not the world's up. Otherwise the rings start passing through each other on the inside of bends.

To draw a ring perpendicular to a direction, you need *two* perpendicular vectors that span the ring's plane. Together with the tangent, those three vectors form a "frame" — an orthonormal basis local to that point on the curve. Standard naming:

- **T** — the tangent (the direction we're moving in)
- **N** — the normal (one of the two perpendiculars)
- **B** — the binormal (the other perpendicular)

T cross N gives B; the three vectors are orthogonal and unit-length and form a tripod attached to the curve.

The trick is: as the curve bends, *the entire frame must rotate together*. If we rotate only T by 20° but leave N and B alone, the ring won't line up with the new tangent — N and B will no longer be perpendicular to T. Geometry breaks; rings face the wrong way; consecutive rings stitch together with a twist.

The fix is exactly what the section heading promised — call the same Rodrigues rotation on N and B with the same axis and angle:

```gml
_T = vec3_rotate(_T, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
_N = vec3_rotate(_N, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
_B = vec3_rotate(_B, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
```

Three lines for three vectors. Each one rotates by the same angle around the same axis, so they stay orthonormal — they're rigidly attached to each other and the rotation is rigid. This is called **parallel transport** of the frame: dragging a basis along a curve in such a way that it stays as "unrotated" as possible relative to its starting orientation, given the constraint that T has to follow the tangent.

The mathematical name for this is parallel transport along a curve. The CS-graphics name is "frame walking." You'll find it in any treatment of differential geometry or any 3D graphics codebase that draws extrusions of arbitrary cross-sections along arbitrary paths.

## The whole loop

Putting it all together — here's the actual loop from the game code, with comments stripped:

```gml
var _frames = array_create(_segments + 1);
var _pos = vec3(0, 0, 0);
var _T   = vec3(0, 0, 1);
var _N   = vec3(1, 0, 0);
var _B   = vec3(0, 1, 0);
var _ds  = _arc_world / _segments;

for (var i = 0; i <= _segments; i++) {
    var _arc_now = (i / _segments) * _arc_world;

    while (_next_event < _events_n
        && (_events[_next_event].y / 100 * BONSAI_DISPLAY_SCALE) <= _arc_now) {
        var _ev = _events[_next_event];
        var _ax = vec3(-dsin(_ev.angle_deg), dcos(_ev.angle_deg), 0);
        _T = vec3_rotate(_T, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
        _N = vec3_rotate(_N, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
        _B = vec3_rotate(_B, _ax, BONSAI_TRUNK_BEND_PER_EVENT);
        _next_event++;
    }

    _frames[i] = { pos: _pos, tangent: _T, normal: _N, binormal: _B };

    if (i < _segments) {
        _pos = vec3(_pos.x + _T.x * _ds, _pos.y + _T.y * _ds, _pos.z + _T.z * _ds);
    }
}
```

Twenty lines of substance. Walk up the trunk in segments. At each segment, apply any bend events whose height we've now passed. Record the frame. Step the position forward by the current tangent.

That's the whole machine. A list of bend events goes in, a curve comes out.

## What this enables

Sticking a few extra rotations into a vertex-buffer pipeline turns out to unlock a *lot* of game design.

Before this commit, three of the six traditional bonsai styles in the game (informal upright, slanting, cascade) had no scoring function. They couldn't be scored because there was no morphology field that captured what they actually were. The lateral-shift code had the player input — `trunk.movement` — but the renderer wasn't really using it as a curve, so there was nothing meaningful for a scorer to read.

Now there is. The same `trunk_frames` function that builds the mesh is called by the style scorers. *What you see is what you're scored on.* A trunk with mixed-direction bends that returns to vertical at the apex scores high on informal upright. A trunk with all bends in the same direction that ends up leaning at 30°-40° scores high on slanting. A trunk where the cumulative bends carry the tip below the base scores high on cascade. Each style asks a question the curve can now answer.

This is one of those moments where you ship one piece of plumbing and three other things you'd been blocked on suddenly work. There's a bandied-about claim in software that good abstractions pay for themselves multiple times. I don't always believe it. This time I do.

---

## Coming next

The next post is the one I almost wrote this week, but the trunk maths jumped the queue: *why the wired branch still looks straight*. Trunks now curve correctly, but branches don't — `branch.bend` rotates the whole branch direction in world XY but the branch geometry itself stays a straight line. Same maths family, slightly different problem (a branch carries a single bend scalar, not a list of events). The post will work through what changes when you go from "list of bend events" to "single bend angle that should curve along the length," and why that's actually a less elegant problem than the trunk turned out to be.

After that, *the 3D viewer is mostly arithmetic* — a series-checkpoint post mapping every kind of maths the viewer uses (trig, vectors, dot/cross products, parametric curves, projection matrices) to the parts of the screen they're responsible for.

Three rotations were the difference between a tree that looked like stacked pancakes and a tree that looked like a tree. That's a number you can hold in your head.
