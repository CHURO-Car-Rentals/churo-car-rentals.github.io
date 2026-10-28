"""Builds the branded CHURO QR code + a printable poster.
Usage: python make_qr.py [URL]   (needs: pip install pillow "qrcode[pil]")"""
import sys, os
import qrcode
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
URL = sys.argv[1] if len(sys.argv) > 1 else "https://churo-car-rentals.github.io/"
INK, BLUE, ACCENT = (7, 26, 51), (22, 104, 227), (44, 197, 232)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=24, border=2)
qr.add_data(URL); qr.make(fit=True)
img = qr.make_image(fill_color=INK, back_color="white").convert("RGBA")
W = img.width
# logo badge in the middle: the car + "CHURO" part of the logo (error level H tolerates the cover)
logo = Image.open(os.path.join(HERE, "..", "logo.jpg")).convert("RGBA").crop((20, 95, 480, 345))
bw = int(W * 0.30); logo.thumbnail((int(bw * 0.88), int(bw * 0.88)), Image.LANCZOS)
badge = Image.new("RGBA", (bw, int(logo.height + bw * 0.14)), (255, 255, 255, 255))
mask = Image.new("L", badge.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, badge.width - 1, badge.height - 1), radius=int(bw * 0.1), fill=255)
badge.paste(logo, ((bw - logo.width) // 2, (badge.height - logo.height) // 2), logo)
img.paste(badge, ((W - badge.width) // 2, (W - badge.height) // 2), mask)
img.convert("RGB").save(os.path.join(HERE, "qr-churo.png"))

def font(sz):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf", "DejaVuSans-Bold.ttf"]:
        try: return ImageFont.truetype(p, sz)
        except OSError: pass
    return ImageFont.load_default()
pad = 120
card = Image.new("RGB", (W + 2 * pad, W + 600), (255, 255, 255)); d = ImageDraw.Draw(card)
d.rectangle((0, 0, card.width, 330), fill=BLUE)
d.rectangle((0, 322, card.width, 330), fill=ACCENT)
for text, size, y, color in [("Scan to book your ride", 100, 110, (255, 255, 255)),
                             ("Rentals · Rent-to-Own · Sarasota, FL", 60, W + 385, INK),
                             ("Fast. Easy. Available!", 74, W + 475, BLUE)]:
    f = font(size); d.text(((card.width - d.textlength(text, font=f)) / 2, y), text, font=f, fill=color)
card.paste(img.convert("RGB"), (pad, 360))
card.save(os.path.join(HERE, "qr-churo-affiche.png"))
print("QR ->", URL)
