# [Math] Drawing a Circle With Six Lines of Code

*This is the first post in a sub-series about the maths that powers the visible parts of BonsaiGame. The series is aimed at high-school students, early-uni folks, and anyone who's wondered what those "do I really need this?" subjects in maths class get used for. The deal: I won't be precious about jargon, but you should know roughly what `cos` and `sin` do, and not be scared of an angle.*

There's a moment in school where the teacher draws a circle on the board, points at it, and says: *every point on this circle is at the same distance from the centre*. And then there's another moment, much later, where they say: *and that distance is called the radius, and we use trigonometry to talk about points on circles.* And then, depending on the teacher and the year, one of two things happens: either you spend a few weeks doing problems about angles and triangles and never quite work out *what for*, or someone shows you a circle that's actually being drawn on a screen, and the maths quietly snaps into focus.

This post is the second one.

## The problem

In BonsaiGame's 3D viewer, the trunk of a tree is a stack of rings. The branches are tubes made of more rings. The wire that wraps a wired branch is a helix made of *yet more* rings. If you can draw a ring, you can draw most of a tree.

A ring, geometrically, is a list of points evenly spaced around a circle. So the question reduces to: given a centre point, a radius, and a number of segments, how do we get those points?

Here is the entire function that does it, in the actual game code, with the comments stripped:

```gml
function build_ring(_center, _radius, _segments) {
    var _ring = array_create(_segments);
    for (var i = 0; i < _segments; i++) {
        var _a = (i / _segments) * 360;
        _ring[i] = vec3(
            _center.x + dcos(_a) * _radius,
            _center.y + dsin(_a) * _radius,
            _center.z
        );
    }
    return _ring;
}
```

Six lines of substance, a `for` loop, two trig calls, some arithmetic. That's the whole machine. Let's pull it apart.

## What `cos` and `sin` are doing

If you draw a circle of radius 1 centred at the origin (0, 0), and you put a dot on the rightmost point, that dot is at coordinates (1, 0). Now imagine sweeping the dot anticlockwise around the circle. After a quarter-turn (90°), the dot is at (0, 1) — top of the circle. After half a turn (180°), it's at (−1, 0). After three-quarters, (0, −1). Back to the start at 360°.

For any angle `a` along that sweep, the position of the dot on a unit circle is:

```
x = cos(a)
y = sin(a)
```

That's it. That's the entire definition of cosine and sine for our purposes. They are *the answers to the question*: "if I sweep around a unit circle, where am I?" Cosine is the x. Sine is the y.

You can check this against a few specific angles you know by heart:

- `cos(0°) = 1`, `sin(0°) = 0` — rightmost point.
- `cos(90°) = 0`, `sin(90°) = 1` — topmost point.
- `cos(180°) = −1`, `sin(180°) = 0` — leftmost point.
- `cos(270°) = 0`, `sin(270°) = −1` — bottommost point.

(Those are the values your calculator gives. If this is the first time you've thought about *why* `cos(0) = 1` instead of just memorising it: the angle 0° puts the dot at (1, 0), and the x is 1. That's why.)

## Scaling to any radius

A unit circle has radius 1, which is rarely what we want. Real game objects have specific sizes. The trunk of a sapling juniper is a couple of millimetres thick. The pedestal under a tree is twenty centimetres across.

If we want a circle of radius `r` instead of radius 1, we multiply both `cos` and `sin` by `r`:

```
x = r * cos(a)
y = r * sin(a)
```

This works because cosine and sine, by themselves, only ever return values between −1 and +1. Multiplying by `r` stretches the unit circle out to radius `r`, in every direction equally.

## Moving to any centre

Our circles aren't always at the origin. The trunk's first ring is at the base of the trunk; later rings are stacked above it. Each ring has a centre that's somewhere specific in 3D space, not (0, 0, 0).

If we want our circle centred at `(cx, cy)` instead of the origin, we add `cx` and `cy` to our coordinates:

```
x = cx + r * cos(a)
y = cy + r * sin(a)
```

That's the formula in the game code. Read the inner expression of `build_ring` again:

```gml
_center.x + dcos(_a) * _radius,
_center.y + dsin(_a) * _radius,
_center.z
```

It's `cx + cos(a) * r` and `cy + sin(a) * r`. The third coordinate, `_center.z`, is just copied through — every point on this ring sits at the same height as the centre. (We're drawing a flat horizontal ring. To draw rings facing other directions you need a slightly bigger toolbox; that's a future post.)

The `dcos` and `dsin` are GameMaker quirks: `cos` and `sin` in GML default to **radians**, but `dcos` and `dsin` use **degrees**. The game's data is in degrees, so we use the d-versions to skip a conversion. If your maths class always used radians, your `cos` would expect radians too — same idea, different unit.

## Spreading the angles evenly

The last piece is the loop:

```gml
for (var i = 0; i < _segments; i++) {
    var _a = (i / _segments) * 360;
    ...
}
```

We're picking `_segments` evenly-spaced angles between 0° and 360°. The trick is `i / _segments`: as `i` counts 0, 1, 2, ..., up to `_segments - 1`, the fraction `i / _segments` walks from 0 up to *almost* 1. Multiplying by 360 stretches that into 0° up to *almost* 360°.

We deliberately don't include 360° itself, because 360° is the same point as 0° — including both would mean two coincident vertices, and the next ring up would be confused about which one to connect to.

Concrete example: with `_segments = 6`, the angles are:

| `i` | `i / 6` | `_a` (degrees) |
|----:|--------:|----------------|
| 0   | 0.000   | 0°             |
| 1   | 0.167   | 60°            |
| 2   | 0.333   | 120°           |
| 3   | 0.500   | 180°           |
| 4   | 0.667   | 240°           |
| 5   | 0.833   | 300°           |

Six points around the circle, 60° apart. With centre `(0, 0)` and radius `1`, the resulting points are:

| Angle | x = cos(a) | y = sin(a) |
|------:|-----------:|-----------:|
| 0°    | 1.000      | 0.000      |
| 60°   | 0.500      | 0.866      |
| 120°  | −0.500     | 0.866      |
| 180°  | −1.000     | 0.000      |
| 240°  | −0.500     | −0.866     |
| 300°  | 0.500      | −0.866     |

If you plot those, you get a hexagon — six points evenly spaced on the unit circle. With more segments (say 32), the hexagon becomes indistinguishable from a smooth circle when you connect the points.

## What this enables

`build_ring` is six lines of code. By itself it's not very impressive — you've drawn a hexagon.

But the moment you start *stacking rings*, things get interesting. Stack two rings of the same radius at different heights, connect them with quads, and you have a cylinder. Stack rings of *gradually decreasing radius*, and you have a tapered cone — which is exactly what a tree trunk is. Stack rings of radius that varies as a function of how high up you are, and you can carve any silhouette of revolution: a vase, a pillar, a bonsai trunk that thins towards the top.

In the game, the trunk is twenty stacked rings, each one slightly smaller than the last. The branches are six-segment tubes built the same way. The wire helix is rings stacked along a corkscrew path. The leaves are little flat squares that *also* turn out to use the same trick rotated sideways.

All of it — the trunk, the branches, the wire, the leaves — comes back to: *given an angle, where is the point?*

That's a question you've been answering since the first time someone drew a unit circle on a board.

---

## Coming next

This was the friendliest possible introduction. The next post takes the same trig and plants a branch on the trunk's surface — *where does branch 3 actually start?* The answer involves the trunk's radius, the branch's attachment angle, and a small detail about where on the surface the branch's geometry should begin. It's the same `cos` and `sin` from this post, doing slightly more work.

After that, we step back: *the 3D viewer is mostly arithmetic*. A walking tour of every kind of maths the viewer uses — trig, vectors, dot products, projections — with a one-paragraph teaser for each. Less worked example, more "here's the map of the country you're about to travel."

If you'd told me at fourteen that the boring "find the angle" exercises would one day let me draw a tree on a screen, I'd have done my homework with more enthusiasm. Maybe.
