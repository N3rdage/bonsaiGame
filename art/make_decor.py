"""
make_decor.py — decor pass (7 sprites), same toolkit/palette as make_assets.py.

These are authored at their listed dims and drawn UNSCALED in-game, so they
carry more detail than the 1.5x-drawn 32px props. Style: slightly oblique
top-down (top surface + a sliver of front face). Shed pieces are composed so
their footprint sits at bottom-centre (the GM origin); spr_fence_v is TL tileable.
"""
import os
import numpy as np
from pixel import (PAL, C, rgba, shade, canvas, px, rect, hline, vline,
                   disc, ellipse, blit, save)

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)

# extra in-family shades (kept warm / within palette spirit)
BURLAP   = rgba(168, 140, 98)
BURLAP_D = rgba(120, 96, 64)
BURLAP_L = rgba(196, 172, 130)
GLASS    = rgba(196, 216, 222)   # pale daylight
GLASS_L  = rgba(224, 238, 240)
GALV     = rgba(168, 170, 172)   # galvanised metal (cool grey)
GALV_D   = rgba(110, 114, 118)
GALV_L   = rgba(206, 208, 210)


def fr(col, f):  # shade an arbitrary rgba
    r, g, b = col[:3]
    return rgba(min(255, r * f), min(255, g * f), min(255, b * f))


def outline_rect(img, x0, y0, x1, y1, fill, edge):
    rect(img, x0, y0, x1, y1, fill)
    hline(img, x0, x1, y0, edge); hline(img, x0, x1, y1, edge)
    vline(img, x0, y0, y1, edge); vline(img, x1, y0, y1, edge)


def little_pot(img, cx, base_y, w=6, h=7, col=None):
    """A small terracotta pot, base centred at (cx, base_y)."""
    col = col or C("terracotta")
    rim = fr(col, 1.12)
    dk = fr(col, 0.8)
    # rim
    rect(img, cx - w // 2 - 1, base_y - h, cx + w // 2, base_y - h + 1, rim)
    # tapered body
    for i, y in enumerate(range(base_y - h + 2, base_y + 1)):
        t = i / max(1, h - 2)
        ww = int(round(w / 2 - t * 1.5))
        rect(img, cx - ww, y, cx + ww, y, col)
        px(img, cx - ww, y, dk)
    rect(img, cx - w // 2, base_y - h + 1, cx + w // 2 - 1, base_y - h + 1, fr(col, 0.55))  # dark opening


# =====================================================================
# spr_shelf  56x44  — wall rack, 2 shelves with small pots + a tin
# =====================================================================
def shelf():
    img = canvas(56, 44)
    wm, wd, wl = C("wood_mid"), C("wood_dark"), C("wood_light")
    # side posts
    rect(img, 2, 1, 6, 43, wm); vline(img, 2, 1, 43, wd); vline(img, 6, 1, 43, fr(wm, 0.8))
    rect(img, 49, 1, 53, 43, wm); vline(img, 53, 1, 43, wd); vline(img, 49, 1, 43, fr(wm, 0.8))
    # top board
    outline_rect(img, 1, 0, 54, 4, wl, wd)
    # two shelf boards (with a thin front face below each for oblique depth)
    for sy in (20, 40):
        rect(img, 5, sy, 50, sy + 2, wl)            # board top
        hline(img, 5, 50, sy, fr(wl, 1.1))
        rect(img, 5, sy + 3, 50, sy + 4, fr(wm, 0.7))  # front face shadow
    # items on upper shelf (y baseline 20): two pots + a tin
    little_pot(img, 14, 20, 7, 9)
    little_pot(img, 24, 20, 6, 7)
    # tin (brass cylinder)
    outline_rect(img, 33, 12, 45, 19, C("brass"), fr(C("brass"), 0.6))
    hline(img, 33, 45, 12, fr(C("brass"), 1.2))
    ellipse(img, 39, 12, 6, 1, fr(C("brass"), 1.25))   # lid rim
    vline(img, 36, 13, 18, fr(C("brass"), 1.15))        # highlight
    # items on lower shelf (baseline 40): a stack-ish trio
    little_pot(img, 16, 40, 8, 10)
    little_pot(img, 30, 40, 6, 8)
    little_pot(img, 42, 40, 7, 9, col=C("terracotta"))
    return img


# =====================================================================
# spr_tools  36x52  — rake + spade + broom leaning together (tall, narrow)
# =====================================================================
def _handle(img, x0, y0, x1, y1, col, edge, width=3):
    """Solid handle from foot (x0,y0) to top (x1,y1), `width` px thick."""
    steps = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(steps + 1):
        t = i / steps
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t)
        for w in range(width):
            px(img, x + w, y, col)
        px(img, x, y, edge)              # left edge shade
        px(img, x + width - 1, y, edge)  # right edge shade


def tools():
    img = canvas(36, 52)
    wm, wl, wd = C("wood_mid"), C("wood_light"), C("wood_dark")
    sg, sgd = C("stone_grey"), C("stone_dark")
    # feet spread along the bottom, tops converging upper-centre = leaning together
    _handle(img, 7, 49, 14, 3, wm, wd)      # spade  (foot left)
    _handle(img, 17, 50, 17, 1, wl, wd)     # rake   (foot centre, near-vertical)
    _handle(img, 27, 49, 20, 5, wm, wd)     # broom  (foot right)
    # spade blade (bottom-left)
    rect(img, 4, 44, 14, 51, sg)
    hline(img, 4, 14, 44, fr(sg, 1.12)); hline(img, 4, 14, 51, sgd)
    vline(img, 4, 44, 51, sgd); vline(img, 14, 44, 51, sgd)
    rect(img, 7, 51, 11, 51, sgd)
    # rake head (bottom-centre): bar + tines
    rect(img, 13, 45, 25, 47, sg); hline(img, 13, 25, 45, fr(sg, 1.12))
    for tx in range(14, 26, 2):
        vline(img, tx, 47, 51, sgd)
    # broom head (bottom-right): straw bundle with binding
    rect(img, 24, 43, 32, 45, wd)
    for bx in range(24, 33):
        vline(img, bx, 45, 51, wl if bx % 2 else wm)
    return img


# =====================================================================
# spr_watering_can  32x30  — galvanised/brass can on the floor
# =====================================================================
def watering_can():
    img = canvas(32, 30)
    # body (rounded galvanised)
    outline_rect(img, 6, 12, 21, 28, GALV, GALV_D)
    rect(img, 6, 12, 7, 28, GALV_L)                 # left highlight band
    ellipse(img, 13, 12, 8, 2, GALV_L)              # top opening rim
    ellipse(img, 13, 12, 6, 1, GALV_D)
    # back handle (arched)
    for i in range(8):
        a = i / 7
        x = round(13 + a * 6); y = round(6 + (a * (1 - a)) * -10 + 6)
        px(img, x, 6 + i, GALV_D)
    rect(img, 12, 4, 16, 6, GALV)                   # handle top
    # spout going up-left with a rose (sprinkler) head
    for i in range(10):
        px(img, 6 - i // 2, 18 - i, GALV)
        px(img, 7 - i // 2, 18 - i, GALV_D)
    disc(img, 1, 8, 2, C("brass"))                  # brass rose
    px(img, 0, 7, fr(C("brass"), 1.2))
    # brass collar accent on body
    hline(img, 6, 21, 24, C("brass"))
    return img


# =====================================================================
# spr_pot_stack  40x40 — empty terracotta pots: a stack + one tipped over
# =====================================================================
def pot_stack():
    img = canvas(40, 40)
    tc, rim, dk = C("terracotta"), fr(C("terracotta"), 1.12), fr(C("terracotta"), 0.78)
    op = fr(C("terracotta"), 0.5)
    # tipped-over pot (front-left), lying on its side -> opening as ellipse
    cy = 33
    for i, x in enumerate(range(4, 20)):            # tapered body lying down
        h = 6 - abs(i - 8) // 4
        rect(img, x, cy - h, x, cy + h, tc)
    rect(img, 18, cy - 3, 20, cy + 3, dk)           # base end
    # open mouth at the left end (rim ring + dark interior)
    ellipse(img, 4, cy, 2, 6, rim)
    ellipse(img, 4, cy, 1, 4, op)
    # standing stack (back-right): two nested pots
    def standing(cx, by, w, h):
        rect(img, cx - w, by - h, cx + w, by - h + 1, rim)   # rim
        for i, y in enumerate(range(by - h + 2, by + 1)):
            t = i / max(1, h - 2)
            ww = int(round(w - t * 2))
            rect(img, cx - ww, y, cx + ww, y, tc)
            px(img, cx - ww, y, dk)
        rect(img, cx - w + 1, by - h + 1, cx + w - 1, by - h + 1, op)  # opening
    standing(28, 24, 8, 14)
    standing(28, 38, 9, 15)
    return img


# =====================================================================
# spr_sack  32x34 — slumped burlap soil sack, a little spilled at base
# =====================================================================
def sack():
    img = canvas(32, 34)
    # slumped body (wider at base, leaning)
    body = [(8, 22, 5), (7, 24, 4), (6, 26, 6), (5, 28, 9),
            (4, 30, 12), (4, 32, 12), (5, 33, 11)]
    for (x0, y, w) in body:
        rect(img, x0, y, x0 + w + 8, y, BURLAP)
    # fuller bottom bulge
    ellipse(img, 16, 30, 13, 6, BURLAP)
    # shading + a vertical seam highlight
    for y in range(22, 34):
        px(img, 6, y, BURLAP_D)
    vline(img, 18, 22, 33, BURLAP_L)
    # tied/cinched top
    rect(img, 11, 18, 21, 22, BURLAP_D)
    rect(img, 13, 14, 19, 19, BURLAP)
    vline(img, 13, 14, 18, BURLAP_D); vline(img, 19, 14, 18, BURLAP_D)
    hline(img, 11, 21, 20, C("wood_dark"))          # the tie
    # stitch ticks down the seam
    for y in range(24, 33, 2):
        px(img, 16, y, BURLAP_D)
    # soil spilled at base
    for (x, y) in [(2, 33), (3, 33), (3, 32), (4, 33), (27, 33), (28, 33),
                   (28, 32), (29, 33), (26, 33)]:
        px(img, x, y, C("soil"))
    px(img, 3, 31, fr(C("soil"), 1.4)); px(img, 28, 31, fr(C("soil"), 1.4))
    return img


# =====================================================================
# spr_window  56x24 — frame, sill, pale daylight glass
# =====================================================================
def window():
    img = canvas(56, 24)
    wm, wd, wl = C("wood_mid"), C("wood_dark"), C("wood_light")
    # outer frame
    outline_rect(img, 0, 0, 55, 19, wm, wd)
    rect(img, 1, 1, 54, 2, wl)                       # top frame highlight
    # glass area
    rect(img, 4, 3, 51, 17, GLASS)
    # diagonal daylight streak
    for i in range(48):
        px(img, 6 + i, 16 - i // 3, GLASS_L)
        px(img, 7 + i, 16 - i // 3, GLASS_L)
    # muntins: one vertical mullion + one horizontal -> 4 panes
    rect(img, 27, 3, 28, 17, wm); vline(img, 27, 3, 17, wd)
    rect(img, 4, 9, 51, 10, wm); hline(img, 4, 51, 9, wd)
    # sill (protruding board at the bottom, oblique front face)
    rect(img, 0, 20, 55, 21, wl)                     # sill top
    rect(img, 1, 22, 54, 23, fr(wm, 0.7))            # sill front face
    hline(img, 0, 55, 20, fr(wl, 1.15))
    return img


# =====================================================================
# spr_fence_v  32x32 — vertical fence run, seamless top & bottom,
# transparent left & right. (spr_fence rotated 90°.)
# =====================================================================
def fence_v():
    img = canvas(32, 32)
    mid, dark, light = C("wood_mid"), C("wood_dark"), C("wood_light")
    # two vertical rails (full height -> seamless top/bottom), centred band
    for ry in (12, 18):
        rect(img, ry, 0, ry + 2, 31, mid, wrap=True)
        vline(img, ry, 0, 31, light, wrap=True)
        vline(img, ry + 2, 0, 31, dark, wrap=True)
    # pickets: short horizontal bars every 8px (tiles vertically)
    for by in (2, 10, 18, 26):
        rect(img, 9, by, 22, by + 2, mid, wrap=True)
        hline(img, 9, 22, by, light, wrap=True)
        hline(img, 9, 22, by + 2, dark, wrap=True)
        vline(img, 9, by, by + 2, light, wrap=True)   # rounded-ish cap
    return img


def main():
    items = [
        ("spr_shelf", shelf()),
        ("spr_tools", tools()),
        ("spr_watering_can", watering_can()),
        ("spr_pot_stack", pot_stack()),
        ("spr_sack", sack()),
        ("spr_window", window()),
        ("spr_fence_v", fence_v()),
    ]
    for name, arr in items:
        save(arr, os.path.join(OUT, name + ".png"))
        print(f"  {name:18s} {arr.shape[1]}x{arr.shape[0]}")


if __name__ == "__main__":
    main()
