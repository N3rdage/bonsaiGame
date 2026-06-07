"""
make_assets.py — generate every sprite slot from ART_SPEC.md.

Output PNGs land in ./out, named exactly as the spec tables require.
Multi-frame sprites are written as horizontal strips (GM "Import Strip"),
frame order matching the spec Notes.
"""
import os
import random
import numpy as np
from pixel import (PAL, C, rgba, shade, canvas, px, rect, hline, vline,
                   disc, ellipse, blit, speckle, save)

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)


def strip(frames):
    """Concatenate equal-size RGBA frames into one horizontal strip array."""
    h = frames[0].shape[0]
    w = sum(f.shape[1] for f in frames)
    out = canvas(w, h)
    x = 0
    for f in frames:
        out[:, x:x + f.shape[1]] = f
        x += f.shape[1]
    return out


# =====================================================================
# FLOORS  (32x32, TL, seamless, low busy)
# =====================================================================
def floor_shed(frame_seed):
    """Horizontal wood planks, seamless on all edges (no vertical board ends
    so left<->right and top<->bottom always meet)."""
    img = canvas(32, 32)
    rng = random.Random(100 + frame_seed)
    # 4 planks, 8px tall; base shade varies slightly per plank per frame
    for p in range(4):
        y0 = p * 8
        f = rng.uniform(0.92, 1.06)
        base = rgba(*[min(255, int(c * f)) for c in PAL["shed_floor"]])
        rect(img, 0, y0, 31, y0 + 7, base)
    # seam lines between planks (wrap vertically: line at y=0 == y=32)
    for p in range(4):
        hline(img, 0, 31, p * 8, C("wood_dark"), wrap=True)
    # subtle horizontal grain streaks, wrapped so they tile horizontally
    for _ in range(7):
        y = rng.randint(1, 31)
        x = rng.randint(0, 31)
        ln = rng.randint(3, 6)
        g = C("wood_mid") if rng.random() < 0.6 else C("wood_light")
        for i in range(ln):
            px(img, x + i, y, g, wrap=True)
    # a couple of nail dots near plank tops (fixed cols read as plank nailing)
    for p in range(4):
        px(img, 3, p * 8 + 2, shade("wood_dark", 0.8))
        px(img, 28, p * 8 + 2, shade("wood_dark", 0.8))
    return img


def floor_garden(frame_seed):
    """Grass, seamless, deliberately low busy so plants read on top."""
    img = canvas(32, 32)
    rng = random.Random(200 + frame_seed)
    rect(img, 0, 0, 31, 31, C("grass"))
    # sparse lighter blades (2px verticals) + single-pixel speckle, all wrap
    for _ in range(10):
        x, y = rng.randint(0, 31), rng.randint(0, 31)
        px(img, x, y, C("grass_light"), wrap=True)
        px(img, x, y - 1, C("grass_light"), wrap=True)
    for _ in range(6):
        x, y = rng.randint(0, 31), rng.randint(0, 31)
        px(img, x, y, shade("grass", 0.85), wrap=True)
    return img


# =====================================================================
# STRUCTURE  (32x32, TL)
# =====================================================================
def wall():
    """Shed wall: vertical boards, darker than the floor, seamless H & V
    (boards repeat every 8px so the tile is periodic in x)."""
    img = canvas(32, 32)
    rng = random.Random(300)
    rect(img, 0, 0, 31, 31, shade("wood_mid", 0.78))  # darker than floor
    for bx in range(0, 32, 8):
        vline(img, bx, 0, 31, C("wood_dark"), wrap=True)        # board seam
        vline(img, bx + 1, 0, 31, shade("wood_mid", 0.92))      # shadow side
        vline(img, bx + 6, 0, 31, shade("wood_light", 0.85))    # highlight side
    # faint horizontal grain ticks (wrap horizontally)
    for _ in range(10):
        x, y = rng.randint(0, 31), rng.randint(0, 31)
        px(img, x, y, shade("wood_dark", 1.15), wrap=True)
    return img


def fence():
    """Garden fence segment: two rails + pickets, transparent above so grass
    shows. Pickets every 8px => seamless horizontally."""
    img = canvas(32, 32)
    mid, dark, light = C("wood_mid"), C("wood_dark"), C("wood_light")
    # pickets (3px wide) from y=8 down to y=27
    for bx in (2, 10, 18, 26):
        rect(img, bx, 8, bx + 2, 27, mid, wrap=True)
        vline(img, bx, 8, 27, dark, wrap=True)            # left edge shade
        vline(img, bx + 2, 8, 27, shade("wood_mid", 1.1), wrap=True)
        hline(img, bx, bx + 2, 8, light, wrap=True)       # rounded-ish top
    # two horizontal rails spanning full width (seamless in x automatically)
    rect(img, 0, 13, 31, 15, mid, wrap=True)
    hline(img, 0, 31, 13, light, wrap=True)
    hline(img, 0, 31, 15, dark, wrap=True)
    rect(img, 0, 22, 31, 24, mid, wrap=True)
    hline(img, 0, 31, 22, light, wrap=True)
    hline(img, 0, 31, 24, dark, wrap=True)
    return img


def door():
    """Door set in a wall, bottom-aligned within the tile."""
    img = canvas(32, 32)
    # short strip of wall to the sides so it reads as 'set in a wall'
    rect(img, 0, 0, 31, 31, shade("wood_mid", 0.70))
    for bx in range(0, 32, 8):
        vline(img, bx, 0, 31, C("wood_dark"))
    # door frame
    rect(img, 6, 3, 25, 31, C("wood_dark"))
    # door leaf
    rect(img, 8, 5, 23, 31, C("wood_mid"))
    rect(img, 8, 5, 9, 31, shade("wood_mid", 1.12))     # left highlight
    rect(img, 22, 5, 23, 31, shade("wood_mid", 0.85))   # right shadow
    # two recessed panels
    for py0, py1 in ((8, 16), (19, 28)):
        rect(img, 11, py0, 20, py1, shade("wood_mid", 0.82))
        rect(img, 12, py0 + 1, 19, py1 - 1, C("wood_mid"))
        hline(img, 12, 19, py0 + 1, shade("wood_mid", 0.7))
    # brass handle
    disc(img, 20, 22, 1, C("brass"))
    px(img, 21, 22, shade("brass", 1.2))
    return img


# =====================================================================
# PROPS  (32x32, origin centre)  -- clean drop-in footprint
# =====================================================================
def _table(top_col, leg_col, y_top=12, y_legs=27):
    """Shared little 4-leg table body."""
    img = canvas(32, 32)
    # legs
    for lx in (7, 23):
        rect(img, lx, y_top + 3, lx + 1, y_legs, leg_col)
    # top slab
    rect(img, 5, y_top, 26, y_top + 3, top_col)
    hline(img, 5, 26, y_top, shade_from(top_col, 1.12))
    hline(img, 5, 26, y_top + 3, shade_from(top_col, 0.78))
    return img


def shade_from(col, f):
    r, g, b = col[:3]
    return rgba(min(255, r * f), min(255, g * f), min(255, b * f))


def workbench():
    img = _table(C("wood_mid"), C("wood_dark"))
    # clay slab (grey) on the left of the top
    rect(img, 8, 9, 14, 11, C("stone_grey"))
    hline(img, 8, 14, 9, shade("stone_grey", 1.1))
    px(img, 8, 11, C("stone_dark")); px(img, 14, 11, C("stone_dark"))
    # mallet on the right: handle + stone head (T shape)
    rect(img, 18, 8, 18, 13, C("wood_light"))   # handle
    rect(img, 20, 6, 23, 9, C("stone_grey"))    # head
    rect(img, 20, 6, 23, 6, shade("stone_grey", 1.12))
    rect(img, 20, 9, 23, 9, C("stone_dark"))
    return img


def planting_table():
    img = _table(C("wood_light"), shade("wood_mid", 0.85))  # lighter sanded top
    # soil mound on the left
    for i, (x0, x1) in enumerate([(7, 14), (8, 13), (9, 12)]):
        hline(img, x0, x1, 11 - i, C("soil"))
    speckle(img, [(9, 9), (12, 10), (11, 8)], shade("soil", 1.4), wrap=False)
    # empty terracotta pot on the right
    rect(img, 18, 7, 23, 8, C("terracotta"))            # rim
    for y in range(9, 12):                              # tapered body
        rect(img, 19, y, 22, y, shade("terracotta", 0.92))
    px(img, 19, 7, shade("terracotta", 1.15)); px(img, 23, 7, C("wood_dark"))
    # dark opening
    rect(img, 19, 8, 22, 8, shade("terracotta", 0.6))
    return img


def shop_kiosk():
    img = canvas(32, 32)
    # counter base
    rect(img, 5, 16, 26, 27, C("wood_mid"))
    rect(img, 5, 16, 26, 16, C("wood_light"))           # countertop edge
    for x in range(7, 26, 4):                           # front planks
        vline(img, x, 17, 27, shade("wood_mid", 0.85))
    rect(img, 5, 26, 26, 27, C("wood_dark"))
    # flat awning roof
    rect(img, 3, 6, 28, 9, shade("wood_light", 0.95))
    rect(img, 3, 6, 28, 6, C("wood_light"))
    rect(img, 3, 9, 28, 9, C("wood_dark"))
    # awning stripe accent
    for x in range(4, 28, 4):
        vline(img, x, 7, 8, C("terracotta"))
    # support posts
    vline(img, 5, 9, 16, C("wood_dark")); vline(img, 26, 9, 16, C("wood_dark"))
    # brass bell on the counter
    disc(img, 16, 13, 2, C("brass"))
    rect(img, 16, 10, 16, 11, shade("brass", 0.8))      # bell handle
    px(img, 16, 15, C("wood_dark"))                     # clapper
    px(img, 14, 12, shade("brass", 1.2))                # glint
    return img


def pedestal():
    img = canvas(32, 32)
    g, d = C("stone_grey"), C("stone_dark")
    lt = shade("stone_grey", 1.12)
    # base
    rect(img, 8, 24, 23, 28, g)
    hline(img, 8, 23, 24, lt); hline(img, 8, 23, 28, d)
    vline(img, 8, 24, 28, lt); vline(img, 23, 24, 28, d)
    # narrow column
    rect(img, 12, 11, 19, 24, g)
    vline(img, 12, 11, 24, lt); vline(img, 19, 11, 24, d)
    # top cap (where a 3D pot would sit)
    rect(img, 9, 7, 22, 11, g)
    hline(img, 9, 22, 7, lt); hline(img, 9, 22, 11, d)
    vline(img, 9, 7, 11, lt); vline(img, 22, 7, 11, d)
    return img


# =====================================================================
# CHARACTER  spr_player  (32x32, centre, 16-frame strip)
# frames 0-3 down, 4-7 up, 8-11 left, 12-15 right ; within each dir the
# 4 frames are a walk cycle: [contact, passL, contact, passR].
# =====================================================================
def _player_frame(direction, phase):
    img = canvas(32, 32)
    SK, SH, HA = C("skin"), C("player_shirt"), C("hair")
    PA, SHOE = C("pants"), C("shoe")
    bob = 1 if phase in (1, 3) else 0          # 1px body bob on passing frames
    swing = {0: 0, 1: 1, 2: 0, 3: -1}[phase]   # leg/arm swing offset

    if direction in ("down", "up"):
        cx = 16
        ytop = 6 + bob
        # head
        rect(img, cx - 4, ytop, cx + 3, ytop + 4, SK)
        rect(img, cx - 4, ytop, cx + 3, ytop + 1, HA)      # hair top
        vline(img, cx - 4, ytop, ytop + 2, HA); vline(img, cx + 3, ytop, ytop + 2, HA)
        if direction == "down":
            px(img, cx - 2, ytop + 3, C("wood_dark"))      # eyes
            px(img, cx + 1, ytop + 3, C("wood_dark"))
        else:  # up = back of head, more hair
            rect(img, cx - 4, ytop, cx + 3, ytop + 3, HA)
        # torso (shirt)
        rect(img, cx - 4, ytop + 5, cx + 3, ytop + 13, SH)
        rect(img, cx - 4, ytop + 5, cx - 4, ytop + 13, shade("player_shirt", 0.85))
        rect(img, cx + 3, ytop + 5, cx + 3, ytop + 13, shade("player_shirt", 1.1))
        # arms (skin) swinging
        rect(img, cx - 6, ytop + 6 + swing, cx - 5, ytop + 11 + swing, SK)
        rect(img, cx + 4, ytop + 6 - swing, cx + 5, ytop + 11 - swing, SK)
        # legs / shoes
        rect(img, cx - 3, ytop + 14, cx - 1, ytop + 18 + (swing > 0), PA)
        rect(img, cx + 1, ytop + 14, cx + 3, ytop + 18 + (swing < 0), PA)
        rect(img, cx - 3, ytop + 18 + (swing > 0), cx - 1, ytop + 19 + (swing > 0), SHOE)
        rect(img, cx + 1, ytop + 18 + (swing < 0), cx + 3, ytop + 19 + (swing < 0), SHOE)

    else:  # left / right profile (build facing-left, mirror for right)
        cx = 16
        ytop = 6 + bob
        # head
        rect(img, cx - 4, ytop, cx + 2, ytop + 4, SK)
        rect(img, cx - 4, ytop, cx + 2, ytop + 1, HA)
        rect(img, cx + 1, ytop, cx + 2, ytop + 3, HA)      # hair at back (right)
        px(img, cx - 3, ytop + 3, C("wood_dark"))          # one eye, facing left
        # torso
        rect(img, cx - 3, ytop + 5, cx + 2, ytop + 13, SH)
        rect(img, cx + 2, ytop + 5, cx + 2, ytop + 13, shade("player_shirt", 0.85))
        # one visible arm swinging front/back
        ax = cx - 1 + swing
        rect(img, ax, ytop + 6, ax + 1, ytop + 11, SK)
        # legs front/back swing
        rect(img, cx - 2 + swing, ytop + 14, cx - 1 + swing, ytop + 19, PA)
        rect(img, cx + 1 - swing, ytop + 14, cx + 2 - swing, ytop + 19, PA)
        rect(img, cx - 2 + swing, ytop + 19, cx - 1 + swing, ytop + 19, SHOE)
        rect(img, cx + 1 - swing, ytop + 19, cx + 2 - swing, ytop + 19, SHOE)
        if direction == "right":
            img = img[:, ::-1].copy()                      # mirror
    return img


def player():
    frames = []
    for d in ("down", "up", "left", "right"):
        for p in range(4):
            frames.append(_player_frame(d, p))
    return strip(frames)


# =====================================================================
# PLANTS  spr_source_plant  (48x48, centre, 3-frame strip: juniper/maple/pine)
# =====================================================================
def _trunk(img, cx, top, bottom):
    rect(img, cx - 1, top, cx + 1, bottom, C("wood_mid"))
    vline(img, cx - 1, top, bottom, C("wood_dark"))


def source_juniper():
    img = canvas(48, 48)
    cx, cy = 24, 26
    _trunk(img, cx, 34, 44)
    # low, bushy, bluish-green: blend foliage toward celadon
    blu = rgba(64, 118, 92)
    blu_l = rgba(96, 150, 120)
    blu_d = rgba(44, 86, 70)
    for (ox, oy, r, c) in [(-7, 4, 9, blu_d), (8, 6, 8, blu_d),
                           (0, 0, 11, blu), (-9, -2, 7, blu),
                           (9, -1, 7, blu), (-3, -7, 7, blu_l),
                           (5, -6, 6, blu_l)]:
        disc(img, cx + ox, cy + oy, r, c)
    # bluish needle highlights
    rng = random.Random(800)
    for _ in range(22):
        x = rng.randint(cx - 11, cx + 11); y = rng.randint(cy - 9, cy + 12)
        if img[y, x, 3]:
            px(img, x, y, blu_l)
    return img


def source_maple():
    img = canvas(48, 48)
    cx, cy = 24, 24
    _trunk(img, cx, 32, 44)
    # rounder, brighter ball
    disc(img, cx, cy, 13, C("foliage_dark"))
    disc(img, cx, cy, 12, C("foliage_mid"))
    disc(img, cx - 3, cy - 3, 8, C("foliage_light"))
    disc(img, cx + 4, cy + 2, 6, C("foliage_mid"))
    ellipse(img, cx, cy - 11, 10, 3, C("foliage_light"))  # bright crown
    return img


def source_pine():
    img = canvas(48, 48)
    cx = 24
    _trunk(img, cx, 38, 45)
    # spiky conical: stacked triangles, dark
    tiers = [(10, 14), (22, 11), (32, 7)]  # (y_base, half_width) top->down order reversed
    layout = [(38, 13), (30, 11), (22, 9), (14, 6)]
    for (yb, hw) in layout:
        for i in range(hw + 1):
            w = hw - i
            hline(img, cx - w, cx + w, yb - i, C("foliage_dark"))
    # mid + light needles on top of each tier
    for (yb, hw) in layout:
        for i in range(0, hw, 2):
            w = hw - i
            col = C("foliage_mid") if i % 4 else C("foliage_light")
            px(img, cx - w, yb - i, col); px(img, cx + w, yb - i, col)
    return img


def source_plant():
    return strip([source_juniper(), source_maple(), source_pine()])


# =====================================================================
# 3D  spr_foliage  (128x128, centre) -- near-white/neutral, alpha shape,
# vertex-colour tinted at runtime so author it pale.
# =====================================================================
def foliage():
    img = canvas(128, 128)
    base = rgba(225, 232, 220)   # near-white neutral green
    dk = rgba(196, 206, 190)
    lt = rgba(244, 248, 240)
    cx = cy = 64
    rng = random.Random(900)
    # a clump of overlapping leaf lobes (leaves bunch, not a solid disc),
    # with alpha gaps near the rim so it reads as foliage when alpha-tested.
    lobes = [(0, 0, 40), (-30, -10, 26), (28, -12, 26), (-22, 22, 24),
             (24, 24, 24), (0, -30, 24), (0, 30, 22)]
    for (ox, oy, r) in lobes:
        disc(img, cx + ox, cy + oy, r, dk)
    for (ox, oy, r) in lobes:
        disc(img, cx + ox, cy + oy, r - 4, base)
    # scattered bright leaf clusters
    for _ in range(60):
        x = rng.randint(20, 108); y = rng.randint(20, 108)
        if img[y, x, 3] == 0:
            continue
        disc(img, x, y, rng.randint(2, 4), lt)
    # punch a few alpha holes so light shows through the canopy
    for _ in range(40):
        x = rng.randint(10, 118); y = rng.randint(10, 118)
        d = (x - cx) ** 2 + (y - cy) ** 2
        if d > 30 ** 2:
            disc(img, x, y, rng.randint(1, 3), rgba(0, 0, 0, 0))
    return img


# =====================================================================
# Drive everything
# =====================================================================
def main():
    written = []

    def w(name, arr):
        p = os.path.join(OUT, name + ".png")
        save(arr, p)
        written.append((name, arr.shape[1], arr.shape[0]))

    # floors (3 frames each)
    w("spr_floor_shed", strip([floor_shed(i) for i in range(3)]))
    w("spr_floor_garden", strip([floor_garden(i) for i in range(3)]))
    # structure
    w("spr_wall", wall())
    w("spr_fence", fence())
    w("spr_door", door())
    # props
    w("spr_workbench", workbench())
    w("spr_planting_table", planting_table())
    w("spr_shop_kiosk", shop_kiosk())
    w("spr_pedestal", pedestal())
    # character
    w("spr_player", player())
    # plants
    w("spr_source_plant", source_plant())
    # 3D foliage
    w("spr_foliage", foliage())

    print("Wrote", len(written), "PNGs to", OUT)
    for n, ww, hh in written:
        print(f"  {n:20s} {ww}x{hh}")


if __name__ == "__main__":
    main()
