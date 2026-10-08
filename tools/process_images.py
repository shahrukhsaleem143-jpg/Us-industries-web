"""Build the site's optimized WebP images from the source company decks.

Usage:
    python3 tools/process_images.py <profile_media_dir> <catalog_media_dir>

<profile_media_dir> is ppt/media from the company profile .pptx (unzipped).
<catalog_media_dir> is ppt/media from the product catalogue .pptx (unzipped).
Output goes to assets/img/.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")


def save(im, rel, max_w=None, quality=80, sizes=()):
    """Save im as WebP at rel, plus optional smaller widths as name-<w>.webp."""
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = im.convert("RGB")
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)
    for w in sizes:
        if im.width > w:
            small = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            small.save(path.replace(".webp", f"-{w}.webp"), "WEBP", quality=quality, method=6)


def editorial_mono(im, contrast=1.18, brightness=0.96):
    """Black-and-white grade with lifted contrast for factory photography."""
    g = ImageOps.grayscale(im)
    g = ImageEnhance.Contrast(g).enhance(contrast)
    g = ImageEnhance.Brightness(g).enhance(brightness)
    return g.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))


def _components(mask):
    """4-connected components of a boolean array -> list of (ys, xs) index arrays."""
    seen = np.zeros_like(mask, dtype=bool)
    comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack, ys, xs = [(y0, x0)], [], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            ys.append(y); xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        comps.append((np.array(ys), np.array(xs)))
    return comps


def remove_corner_mark(im):
    """Inpaint the four-point sparkle mark in the bottom-right of catalogue shots.

    The mark is a light, star-shaped blob. It is found as the most star-like
    component that is brighter than its local background, then filled by
    diffusing the surrounding pixels inward, which works on studio backdrops
    and dark fabric alike.
    """
    im = im.convert("RGB")
    w, h = im.size
    box = (int(w * 0.74), int(h * 0.78), w, h)
    region = im.crop(box)
    arr = np.asarray(region, dtype=np.float32)
    lum = np.asarray(region.convert("L"), dtype=np.float32)
    bg = np.asarray(region.convert("L").filter(ImageFilter.MedianFilter(41)), dtype=np.float32)
    mask = (lum - bg) > 3

    best = None
    for ys, xs in _components(mask):
        bh, bw = np.ptp(ys) + 1, np.ptp(xs) + 1
        fill = len(ys) / float(bh * bw)
        if 10 <= bh <= 90 and 10 <= bw <= 90 and 0.6 <= bh / bw <= 1.6 and 0.2 <= fill <= 0.75:
            if best is None or len(ys) > len(best[0]):
                best = (ys, xs)
    if best is None:
        return im

    hole = np.zeros(mask.shape, dtype=bool)
    hole[best] = True
    hole = np.asarray(Image.fromarray(hole.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(17))) > 0
    # Only fill on plain backdrop: across a garment edge a fill reads as a smudge,
    # which is worse than the mark itself.
    ring = (np.asarray(Image.fromarray(hole.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(31))) > 0) & ~hole
    if lum[ring].std() > 6:
        return im

    out = arr.copy()
    out[hole] = arr[~hole].mean(axis=0)
    for _ in range(400):  # Laplace fill: masked pixels take the mean of their neighbours
        avg = (np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 4
        out[hole] = avg[hole]
    # Re-grain the filled patch so it matches the photo's texture.
    rng = np.random.default_rng(7)
    out[hole] += rng.normal(0, 1.2, size=(hole.sum(), 1))
    im.paste(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), box[:2])
    return im


def crop_frac(im, x0, y0, x1, y1):
    w, h = im.size
    return im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def main(profile_dir, catalog_dir):
    # --- Factory photography: 12 panels of the end-to-end process sheet ---
    sheet = Image.open(os.path.join(profile_dir, "image2.png")).convert("RGB")
    cols = [(2, 371), (380, 755), (764, 1143), (1152, 1534)]
    rows = [(95, 296), (390, 563), (668, 820)]
    names = [
        ["cutting", "printing", "embroidery", "sewing"],
        ["inline-qc", "washing", "finishing", "final-qc"],
        ["folding", "packing", "cartons", "warehouse"],
    ]
    for r, (y0, y1) in enumerate(rows):
        for c, (x0, x1) in enumerate(cols):
            panel = sheet.crop((x0, y0, x1, y1))
            panel = panel.resize((panel.width * 2, panel.height * 2), Image.LANCZOS)
            save(editorial_mono(panel), f"factory/{names[r][c]}.webp", quality=74)

    # --- Campaign photography from the profile collage ---
    collage = Image.open(os.path.join(profile_dir, "image.jpeg")).convert("RGB")
    campaign = {
        "legend": (0, 0, 328, 648),
        "weekend": (352, 0, 981, 423),
        "essential": (1005, 0, 1333, 648),
        "group": (352, 448, 981, 872),
        "thermal": (0, 672, 328, 1321),
        "wolf": (352, 896, 981, 1320),
        "flight": (1005, 672, 1333, 1320),
        "voltage": (0, 1345, 667, 1989),
        "ultimate": (678, 1345, 1333, 1999),
    }
    for name, box in campaign.items():
        save(collage.crop(box), f"campaign/{name}.webp", quality=80)

    # --- Product catalogue ---
    def cat(i):
        return Image.open(glob.glob(os.path.join(catalog_dir, f"image{i}.*"))[0])

    # Slides whose artwork carries third-party marks or characters are left out.
    skip = {1, 2, 11, 20, 21, 22, 34}
    for path in glob.glob(os.path.join(catalog_dir, "image*")):
        stem = os.path.splitext(os.path.basename(path))[0]
        n = int(stem.replace("image", ""))
        if n in skip or path.endswith(".emf"):
            continue
        save(remove_corner_mark(Image.open(path)), f"products/p{n:02d}.webp",
             max_w=1000, quality=80, sizes=(560,))

    # --- Craft close-ups cropped from catalogue shots ---
    details = {
        "wash-texture": (12, (0.26, 0.36, 0.70, 0.66)),
        "stones": (19, (0.10, 0.56, 0.88, 0.84)),
        "puff-print": (9, (0.60, 0.38, 0.94, 0.64)),
        "applique": (3, (0.10, 0.62, 0.52, 0.86)),
        "embroidery": (29, (0.28, 0.32, 0.96, 0.62)),
        "rib-cuff": (40, (0.56, 0.68, 0.98, 0.93)),
        "raglan-seam": (47, (0.10, 0.08, 0.58, 0.46)),
        "fleece": (43, (0.30, 0.28, 0.72, 0.60)),
        "chain-stones": (6, (0.22, 0.10, 0.78, 0.56)),
    }
    for name, (i, frac) in details.items():
        im = crop_frac(remove_corner_mark(cat(i)), *frac)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
        save(im, f"detail/{name}.webp", max_w=900, quality=80)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
