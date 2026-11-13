"""Genera una foto de prueba (remera verde sobre fondo claro) para probar la detección de color."""
import os
from PIL import Image, ImageDraw

W, H = 900, 1100
BG = (245, 243, 239)
GREEN = (79, 122, 74)
DARK = (52, 82, 48)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# sombra suave
d.ellipse([220, 860, 690, 930], fill=(228, 224, 216))

# remera
shirt = [
    (320, 260), (380, 228), (450, 250), (520, 228), (580, 260),
    (700, 320), (650, 455), (580, 412), (580, 880), (320, 880),
    (320, 412), (250, 455), (200, 320),
]
d.polygon(shirt, fill=GREEN)
d.line(shirt + [shirt[0]], fill=DARK, width=6, joint="curve")

# cuello
d.ellipse([402, 214, 498, 282], fill=BG)
d.arc([402, 214, 498, 282], start=0, end=180, fill=DARK, width=7)

# mangas y ruedo
d.line([(250, 455), (320, 412)], fill=DARK, width=6)
d.line([(650, 455), (580, 412)], fill=DARK, width=6)
d.line([(320, 866), (580, 866)], fill=DARK, width=6)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots", "test-remera.jpg")
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "JPEG", quality=90)
print("Foto de prueba:", os.path.abspath(out))
