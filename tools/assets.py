"""Asset pipeline: turns the generated source art in ../art/gen into game-ready PNGs in src/assets.

Run: python3 tools/assets.py   (needs Pillow, numpy, scipy)

All game textures are authored at 2x the logical resolution (logical 360x640 -> 720x1280)
and drawn with setScale(0.5), so they map 1:1 onto the canvas at zoom 2.
"""
import json
import os
import subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', 'art', 'gen'))
OUT = os.path.normpath(os.path.join(HERE, '..', 'src', 'assets'))
os.makedirs(OUT, exist_ok=True)

OUTLINE = (43, 26, 16)


def save(im: Image.Image, name: str, colors=None):
    p = os.path.join(OUT, name)
    if colors:
        if im.mode == 'RGBA':
            q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        else:
            q = im.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q.save(p, optimize=True)
    else:
        im.save(p, optimize=True)
    subprocess.run(['optipng', '-quiet', '-o2', p], check=False)
    return os.path.getsize(p)


def key_green(im: Image.Image) -> Image.Image:
    """remove leftover chroma green (ground blobs, fringes)"""
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    green = (g > r + 40) & (g > b + 40)
    a[green, 3] = 0
    # de-spill: pull greenish fringe toward neutral
    spill = (g > r) & (g > b) & (al > 0)
    a[..., 1] = np.where(spill, np.maximum(r, b), g)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def components(im: Image.Image, min_area=400, dilate=6):
    al = np.array(im)[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=dilate))
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None:
            continue
        ys, xs = sl
        area = int((al[sl] & (lab[sl] == i + 1)).sum())
        if area < min_area:
            continue
        boxes.append((xs.start, ys.start, xs.stop, ys.stop, area))
    return boxes


def rows_of(boxes, n_rows):
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    out, cur = [], []
    for b in boxes:
        if cur and abs(((b[1] + b[3]) / 2) - ((cur[0][1] + cur[0][3]) / 2)) > 90:
            out.append(sorted(cur, key=lambda c: c[0]))
            cur = []
        cur.append(b)
    if cur:
        out.append(sorted(cur, key=lambda c: c[0]))
    return out


def harden(im: Image.Image, outline=True) -> Image.Image:
    a = np.array(im)
    al = a[..., 3] > 110
    a[..., 3] = np.where(al, 255, 0)
    if outline:
        nb = ndimage.binary_dilation(al, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~al
        a[nb] = (*OUTLINE, 255)
    return Image.fromarray(a, 'RGBA')


# ------------------------------------------------------------------ studio backgrounds
def backgrounds():
    sizes = {}
    srcs = {1: 'bg1_crop.png', 2: 'bg2_r.png', 3: 'bg3_r.png'}
    for lv, f in srcs.items():
        im = Image.open(os.path.join(SRC, f)).convert('RGB')
        if im.size != (768, 1195):
            im = im.resize((768, 1195), Image.LANCZOS)
        im = im.crop((0, 60, 768, 1169)).resize((720, 1040), Image.LANCZOS)
        sizes[f'bg{lv}'] = save(im, f'bg{lv}.png', colors=256)
    return sizes


# ------------------------------------------------------------------ characters
CHAR_H = 58  # idle height in 2x pixels (~29 logical)
SHEETS = ['chars1.png', 'chars2.png', 'chars3.png', 'chars4.png', 'chars5.png']


def characters():
    frames = []  # list of [idle, walk, action] RGBA images (unscaled crops)
    for f in SHEETS:
        im = key_green(Image.open(os.path.join(SRC, f)))
        rows = rows_of(components(im, min_area=1500, dilate=3), 4)
        assert len(rows) == 4, (f, [len(r) for r in rows])
        for r in rows:
            assert len(r) == 3, (f, r)
            frames.append([im.crop(b[:4]) for b in r])
    idle_h = [fr[0].size[1] for fr in frames]
    med = sorted(idle_h)[len(idle_h) // 2]
    scale = CHAR_H / med
    # pack into one atlas: each cell CW x CH, feet at bottom center
    scaled = []
    for fr in frames:
        row = []
        for im in fr:
            w, h = im.size
            nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
            row.append(harden(im.resize((nw, nh), Image.LANCZOS)))
        scaled.append(row)
    CW = max(im.size[0] for row in scaled for im in row) + 2
    CH = max(im.size[1] for row in scaled for im in row) + 2
    CW += CW % 2
    CH += CH % 2
    atlas = Image.new('RGBA', (CW * 3, CH * len(scaled)), (0, 0, 0, 0))
    for i, row in enumerate(scaled):
        for j, im in enumerate(row):
            w, h = im.size
            atlas.paste(im, (j * CW + (CW - w) // 2, i * CH + CH - h - 1), im)
    size = save(atlas, 'chars.png', colors=200)
    return {'chars': size, 'cell': [CW, CH], 'count': len(scaled)}


# ------------------------------------------------------------------ rating screen
def living():
    sizes = {}
    for mood in ['cry', 'laugh', 'shock', 'bored', 'normal']:
        im = Image.open(os.path.join(SRC, f'living_{mood}.png')).convert('RGB')
        im = im.resize((720, round(720 * im.size[1] / im.size[0])), Image.LANCZOS)
        sizes['living_' + mood] = save(im, f'living_{mood}.png', colors=200)
    return sizes


def critics():
    im = Image.open(os.path.join(SRC, 'critics.png')).convert('RGB')
    # colored portrait squares (detected once; the generated sheet is fixed)
    objs = [(37, 120, 370, 459), (398, 120, 731, 459), (37, 699, 370, 1084), (398, 699, 731, 1084)]
    out = Image.new('RGB', (120 * 4, 120))
    for i, (x0, y0, x1, y1) in enumerate(objs):
        s = min(x1 - x0, y1 - y0) - 26
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        crop = im.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2)).resize((120, 120), Image.LANCZOS)
        out.paste(crop, (i * 120, 0))
    return {'critics': save(out, 'critics.png', colors=200)}


def sheet_items(name, n_expected, max_dim, dilate=12):
    im = key_green(Image.open(os.path.join(SRC, name)))
    boxes = components(im, min_area=800, dilate=dilate)
    boxes.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / 150), b[0]))
    assert len(boxes) == n_expected, (name, len(boxes), boxes)
    items = []
    for b in boxes:
        c = im.crop(b[:4])
        w, h = c.size
        s = max_dim / max(w, h) if isinstance(max_dim, (int, float)) else 1
        items.append(c.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS))
    return items


def ui():
    sizes = {}
    icons = sheet_items('icons.png', 8, 60)
    names = ['menu', 'staff', 'film', 'house', 'money', 'star', 'bulb', 'heart']
    CW = 64
    atlas = Image.new('RGBA', (CW * len(icons), CW), (0, 0, 0, 0))
    for i, ic in enumerate(icons):
        ic = harden(ic, outline=False)
        w, h = ic.size
        atlas.paste(ic, (i * CW + (CW - w) // 2, (CW - h) // 2), ic)
    sizes['icons'] = save(atlas, 'icons.png', colors=128)
    im = key_green(Image.open(os.path.join(SRC, 'ribbons.png')))
    boxes = components(im, min_area=800, dilate=4)
    boxes.sort(key=lambda b: (round(b[1] / 300), b[0]))
    assert len(boxes) == 3, boxes
    banner = harden(im.crop(boxes[0][:4]), outline=False)
    bw = 640
    banner = banner.resize((bw, round(bw * banner.size[1] / banner.size[0])), Image.LANCZOS)
    sizes['banner'] = save(harden(banner, outline=False), 'banner.png', colors=96)
    for nm, b in [('rosette_gold', boxes[1]), ('rosette_silver', boxes[2])]:
        r = im.crop(b[:4])
        r = r.resize((150, round(150 * r.size[1] / r.size[0])), Image.LANCZOS)
        sizes[nm] = save(harden(r, outline=False), nm + '.png', colors=96)
    return sizes, names


if __name__ == '__main__':
    info = {}
    info.update(backgrounds())
    ch = characters()
    info.update(ch)
    info.update(living())
    info.update(critics())
    s, names = ui()
    info.update(s)
    total = sum(v for k, v in info.items() if isinstance(v, int) and k not in ('count',))
    print(json.dumps(info, indent=1))
    print('total bytes', total)
    with open(os.path.join(OUT, 'meta.json'), 'w') as fh:
        json.dump({'charCell': ch['cell'], 'charCount': ch['count'], 'icons': names}, fh)
