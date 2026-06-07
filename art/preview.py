"""preview.py — magnified contact sheet so the 1:1 art can be judged at the
2-4x it'll be seen at, with floors/wall/fence tiled 3x3 to check seams."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "out")
SHED_BG = (60, 44, 32)      # warm shed mood
GARDEN_BG = (40, 64, 38)    # cool garden mood
CARD = (32, 30, 28)
SCALE = 6


def load(name):
    return Image.open(os.path.join(OUT, name + ".png")).convert("RGBA")


def frames_of(img, fw):
    return [img.crop((i * fw, 0, i * fw + fw, img.height))
            for i in range(img.width // fw)]


def up(img, s=SCALE):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def tile(img, n=3, s=4):
    w, h = img.size
    big = Image.new("RGBA", (w * n, h * n))
    for j in range(n):
        for i in range(n):
            big.alpha_composite(img, (i * w, j * h))
    return big.resize((w * n * s, h * n * s), Image.NEAREST)


def main():
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 18)
        small = ImageFont.truetype("DejaVuSans.ttf", 14)
    except Exception:
        font = small = ImageFont.load_default()

    W = 1180
    sheet = Image.new("RGBA", (W, 1820), (24, 22, 20, 255))
    d = ImageDraw.Draw(sheet)
    y = 20
    d.text((20, y), "ART_SPEC assets - preview @ nearest-neighbour", font=font, fill=(235, 230, 220))
    y += 36

    def card(x, yy, w, h, bg):
        d.rounded_rectangle([x, yy, x + w, yy + h], 8, fill=bg)

    def label(x, yy, t, sub=""):
        d.text((x, yy), t, font=small, fill=(235, 230, 220))
        if sub:
            d.text((x, yy + 16), sub, font=small, fill=(150, 145, 138))

    # --- floors & wall & fence: tiled 3x3 to show seams ---
    d.text((20, y), "Tileables (3x3, checking seams)", font=font, fill=(220, 200, 170)); y += 30
    x = 20
    for name, bg in [("spr_floor_shed", SHED_BG), ("spr_floor_garden", GARDEN_BG),
                     ("spr_wall", SHED_BG)]:
        f0 = frames_of(load(name), 32)[0]
        t = tile(f0, 3, 4)  # 384x384
        card(x, y, t.width + 16, t.height + 40, CARD)
        sheet.alpha_composite(Image.new("RGBA", t.size, bg + (255,)), (x + 8, y + 8))
        sheet.alpha_composite(t, (x + 8, y + 8))
        label(x + 8, y + t.height + 14, name)
        x += t.width + 30
    y += 384 + 60

    # fence over grass, tiled horizontally
    d.text((20, y), "spr_fence (tiled x3 over grass) + spr_door", font=font, fill=(220, 200, 170)); y += 30
    grass = frames_of(load("spr_floor_garden"), 32)[0]
    fen = load("spr_fence")
    strip = Image.new("RGBA", (96, 32))
    for i in range(3):
        strip.alpha_composite(grass, (i * 32, 0)); strip.alpha_composite(grass, (i * 32, 0))
    for i in range(3):
        strip.alpha_composite(fen, (i * 32, 0))
    bigf = up(strip, 5)
    card(20, y, bigf.width + 16, bigf.height + 40, CARD)
    sheet.alpha_composite(Image.new("RGBA", bigf.size, GARDEN_BG + (255,)), (28, y + 8))
    sheet.alpha_composite(bigf, (28, y + 8))
    label(28, y + bigf.height + 14, "spr_fence x3")
    # door
    dr = up(load("spr_door"), 5)
    dx = 20 + bigf.width + 40
    card(dx, y, dr.width + 16, dr.height + 40, CARD)
    sheet.alpha_composite(Image.new("RGBA", dr.size, SHED_BG + (255,)), (dx + 8, y + 8))
    sheet.alpha_composite(dr, (dx + 8, y + 8))
    label(dx + 8, y + dr.height + 14, "spr_door")
    y += bigf.height + 60

    # --- props row ---
    d.text((20, y), "Props (32x32, centre)", font=font, fill=(220, 200, 170)); y += 30
    x = 20
    for name in ["spr_workbench", "spr_planting_table", "spr_shop_kiosk", "spr_pedestal"]:
        im = up(load(name), 5)
        card(x, y, im.width + 16, im.height + 40, CARD)
        sheet.alpha_composite(Image.new("RGBA", im.size, SHED_BG + (255,)), (x + 8, y + 8))
        sheet.alpha_composite(im, (x + 8, y + 8))
        label(x + 8, y + im.height + 14, name.replace("spr_", ""))
        x += im.width + 26
    y += 160 + 50

    # --- player: all 16 frames ---
    d.text((20, y), "spr_player (16 frames: down/up/left/right x 4 walk)", font=font, fill=(220, 200, 170)); y += 30
    pf = frames_of(load("spr_player"), 32)
    rows = ["down", "up", "left", "right"]
    x0 = 20
    RS = 104  # row spacing (sprite is 32*3=96 tall)
    for r in range(4):
        d.text((x0, y + r * RS + 36), rows[r], font=small, fill=(180, 175, 168))
        for c in range(4):
            im = up(pf[r * 4 + c], 3)
            xx = x0 + 70 + c * 104
            card(xx, y + r * RS, im.width + 8, im.height + 8, CARD)
            sheet.alpha_composite(im, (xx + 4, y + r * RS + 4))
    y += 4 * RS + 30

    # --- source plants + foliage ---
    d.text((20, y), "spr_source_plant (juniper / maple / pine) + spr_foliage", font=font, fill=(220, 200, 170)); y += 30
    sp = frames_of(load("spr_source_plant"), 48)
    x = 20
    for im0, nm in zip(sp, ["juniper", "maple", "pine"]):
        im = up(im0, 4)
        card(x, y, im.width + 16, im.height + 36, CARD)
        sheet.alpha_composite(Image.new("RGBA", im.size, GARDEN_BG + (255,)), (x + 8, y + 8))
        sheet.alpha_composite(im, (x + 8, y + 8))
        label(x + 8, y + im.height + 12, nm)
        x += im.width + 26
    fol = up(load("spr_foliage"), 2)
    card(x, y, fol.width + 16, fol.height + 36, CARD)
    # checker bg to show alpha
    chk = Image.new("RGBA", fol.size, (70, 70, 70, 255))
    cd = ImageDraw.Draw(chk)
    for j in range(0, fol.height, 16):
        for i in range(0, fol.width, 16):
            if (i // 16 + j // 16) % 2:
                cd.rectangle([i, j, i + 15, j + 15], fill=(90, 90, 90, 255))
    sheet.alpha_composite(chk, (x + 8, y + 8))
    sheet.alpha_composite(fol, (x + 8, y + 8))
    label(x + 8, y + fol.height + 12, "spr_foliage (pale; tinted at runtime)")

    sheet.convert("RGB").save(os.path.join(OUT, "_preview.png"))
    print("preview written")


if __name__ == "__main__":
    main()
