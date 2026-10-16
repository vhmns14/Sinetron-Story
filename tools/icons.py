# Generate pixel-art PWA icons (TV with crying face) using PIL.
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

def art(n=32, pad=0, bg=(138, 82, 40)):
    im = Image.new('RGBA', (n, n), bg + (255,))
    d = ImageDraw.Draw(im)
    o = (43, 26, 16)
    s = (n - 2 * pad) / 32.0
    def r(x, y, w, h, c):
        d.rectangle([pad + x * s, pad + y * s, pad + (x + w) * s - 1, pad + (y + h) * s - 1], fill=c)
    # background frame
    r(1, 1, 30, 30, (106, 58, 24)); r(2, 2, 28, 28, (246, 196, 64)); r(3, 3, 26, 26, (251, 236, 200))
    # antenna
    r(10, 4, 2, 2, o); r(12, 6, 2, 2, o); r(20, 4, 2, 2, o); r(18, 6, 2, 2, o)
    # tv body
    r(5, 8, 22, 17, o); r(6, 9, 20, 15, (90, 90, 100)); r(8, 11, 16, 11, o); r(9, 12, 14, 9, (120, 200, 240))
    # crying face on screen
    r(11, 14, 2, 1, o); r(19, 14, 2, 1, o)
    r(12, 15, 1, 4, (40, 120, 255)); r(19, 15, 1, 4, (40, 120, 255))
    r(14, 18, 4, 2, (122, 30, 20))
    # legs
    r(8, 25, 3, 2, o); r(21, 25, 3, 2, o)
    # heart badge
    r(23, 4, 2, 1, (224, 64, 96)); r(26, 4, 2, 1, (224, 64, 96)); r(22, 5, 7, 2, (224, 64, 96)); r(23, 7, 5, 1, (224, 64, 96)); r(24, 8, 3, 1, (224, 64, 96)); r(25, 9, 1, 1, (224, 64, 96))
    return im

for size in (192, 512):
    a = art(32)
    a.resize((size, size), Image.NEAREST).save(os.path.join(OUT, f'icon-{size}.png'))
    # maskable: content inside 80% safe zone
    base = Image.new('RGBA', (size, size), (138, 82, 40, 255))
    inner = art(32).resize((int(size * 0.72), int(size * 0.72)), Image.NEAREST)
    off = (size - inner.size[0]) // 2
    base.paste(inner, (off, off))
    base.save(os.path.join(OUT, f'icon-maskable-{size}.png'))
art(32).resize((180, 180), Image.NEAREST).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('ok')
