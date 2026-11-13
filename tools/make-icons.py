"""Genera los íconos de Mi Placard (PNG) sin dependencias externas más que Pillow."""
import os
from PIL import Image, ImageDraw

BG = (210, 94, 59, 255)      # terracota
FG = (255, 249, 244, 255)    # crema
BASE = 1024
SS = 2                        # supersampling


def icon(size, radius_ratio=0.22, padding=0.03):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S, S], radius=int(S * radius_ratio), fill=BG)

    gs = S * (1 - 2 * padding)
    ox = oy = S * padding

    def p(x, y):
        return (ox + x * gs, oy + y * gs)

    width = max(2, int(gs * 0.043))

    # gancho (arco abierto, como una percha de verdad)
    cx, cy, r = 0.5, 0.27, 0.058
    d.arc([p(cx - r, cy - r), p(cx + r, cy + r)], start=235, end=555, fill=FG, width=width)
    # vástago
    d.line([p(0.5, 0.328), p(0.5, 0.405)], fill=FG, width=width)
    # cuerpo de la percha
    pts = [
        p(0.5, 0.405), p(0.235, 0.600), p(0.235, 0.695),
        p(0.765, 0.695), p(0.765, 0.600), p(0.5, 0.405),
    ]
    d.line(pts, fill=FG, width=width, joint="curve")
    for end in (p(0.235, 0.695), p(0.765, 0.695)):
        d.ellipse([end[0] - width / 2, end[1] - width / 2, end[0] + width / 2, end[1] + width / 2], fill=FG)

    return img.resize((size, size), Image.LANCZOS)


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)

    master = icon(BASE, radius_ratio=0.22, padding=0.03)
    master.save(os.path.join(out, "icon-512.png"))
    master.resize((192, 192), Image.LANCZOS).save(os.path.join(out, "icon-192.png"))

    maskable = icon(BASE, radius_ratio=0.0, padding=0.10)
    maskable.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon-maskable-512.png"))

    apple = icon(BASE, radius_ratio=0.0, padding=0.06)
    apple.resize((180, 180), Image.LANCZOS).save(os.path.join(out, "apple-touch-icon.png"))

    master.resize((32, 32), Image.LANCZOS).save(os.path.join(out, "favicon-32.png"))
    print("Íconos generados en", os.path.abspath(out))


if __name__ == "__main__":
    main()
