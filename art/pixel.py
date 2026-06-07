"""
pixel.py — tiny hard-edged pixel-art toolkit + the ART_SPEC palette.

Everything draws directly into an HxWx4 uint8 RGBA numpy array, so there is
NO anti-aliasing anywhere: every edge is a hard pixel boundary, backgrounds
stay fully transparent, and output dimensions are exact. Authored at 1:1
(1 array cell == 1 game pixel), meant to be viewed at 2-4x nearest-neighbour.
"""
import numpy as np
from PIL import Image

# ---- Palette (RGB straight from ART_SPEC.md) -------------------------------
PAL = {
    "wood_mid":      (120, 85, 55),
    "wood_dark":     (70, 45, 25),
    "wood_light":    (160, 110, 70),
    "shed_floor":    (104, 76, 52),
    "stone_grey":    (160, 155, 150),
    "stone_dark":    (90, 88, 85),
    "grass":         (48, 80, 44),
    "grass_light":   (70, 110, 60),
    "foliage_mid":   (75, 120, 65),
    "foliage_light": (95, 140, 75),
    "foliage_dark":  (45, 75, 40),
    "terracotta":    (150, 90, 55),
    "celadon":       (60, 110, 105),
    "soil":          (48, 34, 24),
    "player_shirt":  (80, 110, 160),
    "skin":          (200, 150, 110),
    "brass":         (170, 140, 70),
    # character-only shades (kept in-family, not in the shared table):
    "pants":         (58, 70, 96),    # darker shirt
    "shoe":          (52, 40, 30),    # near wood_dark
    "hair":          (70, 45, 25),    # == wood_dark
}


def C(name, a=255):
    """Palette colour -> RGBA tuple (optionally with alpha)."""
    r, g, b = PAL[name]
    return (r, g, b, a)


def rgba(r, g, b, a=255):
    return (int(r), int(g), int(b), int(a))


def shade(name, f):
    """Multiply a palette colour's RGB by f (f<1 darker, f>1 lighter), clamp."""
    r, g, b = PAL[name]
    return rgba(min(255, r * f), min(255, g * f), min(255, b * f))


# ---- Canvas + primitives ---------------------------------------------------
def canvas(w, h):
    """Fully transparent RGBA canvas."""
    return np.zeros((h, w, 4), dtype=np.uint8)


def _wrap(v, n):
    return v % n


def px(img, x, y, col, wrap=False):
    h, w = img.shape[:2]
    if wrap:
        x, y = _wrap(x, w), _wrap(y, h)
    elif x < 0 or y < 0 or x >= w or y >= h:
        return
    img[y, x] = col


def rect(img, x0, y0, x1, y1, col, wrap=False):
    """Filled rectangle, inclusive coords."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(img, x, y, col, wrap)


def hline(img, x0, x1, y, col, wrap=False):
    for x in range(x0, x1 + 1):
        px(img, x, y, col, wrap)


def vline(img, x, y0, y1, col, wrap=False):
    for y in range(y0, y1 + 1):
        px(img, x, y, col, wrap)


def disc(img, cx, cy, r, col, wrap=False):
    """Hard-edged filled circle (aliased)."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px(img, x, y, col, wrap)


def ellipse(img, cx, cy, rx, ry, col, wrap=False):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if rx and ry and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                px(img, x, y, col, wrap)


def blit(dst, src, ox, oy):
    """Alpha-over composite src onto dst at (ox, oy)."""
    sh, sw = src.shape[:2]
    for y in range(sh):
        for x in range(sw):
            sa = src[y, x, 3]
            if sa == 0:
                continue
            dx, dy = ox + x, oy + y
            if 0 <= dx < dst.shape[1] and 0 <= dy < dst.shape[0]:
                if sa == 255:
                    dst[dy, dx] = src[y, x]
                else:  # simple src-over
                    a = sa / 255.0
                    dst[dy, dx, :3] = (src[y, x, :3] * a +
                                       dst[dy, dx, :3] * (1 - a)).astype(np.uint8)
                    dst[dy, dx, 3] = max(dst[dy, dx, 3], sa)


# ---- Deterministic value noise (seamless / repeatable) ---------------------
def speckle(img, points, col, wrap=True):
    """Plot a list of (x, y) points in one colour (wrapping by default)."""
    for x, y in points:
        px(img, x, y, col, wrap)


def save(img, path):
    Image.fromarray(img, "RGBA").save(path)
    return path
