#!/usr/bin/env python3
"""Génère les icônes PNG et l'archive omni-calculateur.zip."""

from pathlib import Path
import struct
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "icons"


def png_chunk(chunk_type, data):
    checksum = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", checksum)
    )


def create_icon(size, destination, maskable=False):
    """Crée une icône PNG 8-bit RGB opaque, avec marge élargie si maskable."""
    background = (13, 9, 22)
    body = (247, 241, 255)
    screen = (124, 58, 237)
    key = (208, 178, 255)
    accent_key = (124, 58, 237)

    pixels = [
        [background for _ in range(size)]
        for _ in range(size)
    ]

    def rectangle(x0, y0, x1, y1, color):
        x0 = max(0, int(x0))
        y0 = max(0, int(y0))
        x1 = min(size, int(x1))
        y1 = min(size, int(y1))

        for y in range(y0, y1):
            pixels[y][x0:x1] = [color] * (x1 - x0)

    if maskable:
        # Zone centrale réduite (rayon max ~0,344 <= 0,40) pour maskable.
        bx0, by0, bx1, by1 = 0.30, 0.22, 0.70, 0.78
        sx0, sy0, sx1, sy1 = 0.34, 0.27, 0.66, 0.37
        left, top = 0.36, 0.44
        key_w, key_h, gap = 0.075, 0.075, 0.028
    else:
        bx0, by0, bx1, by1 = 0.27, 0.17, 0.73, 0.83
        sx0, sy0, sx1, sy1 = 0.32, 0.23, 0.68, 0.35
        left, top = 0.34, 0.43
        key_w, key_h, gap = 0.09, 0.09, 0.035

    rectangle(size * bx0, size * by0, size * bx1, size * by1, body)
    rectangle(size * sx0, size * sy0, size * sx1, size * sy1, screen)

    for row in range(3):
        for column in range(3):
            x0 = size * (left + column * (key_w + gap))
            y0 = size * (top + row * (key_h + gap))
            color = accent_key if (row == 2 and column == 2) else key
            rectangle(x0, y0, x0 + size * key_w, y0 + size * key_h, color)

    raw_rows = []
    for row in pixels:
        raw_rows.append(
            b"\x00" + bytes(
                channel
                for pixel in row
                for channel in pixel
            )
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png_data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(b"".join(raw_rows), 9))
        + png_chunk(b"IEND", b"")
    )
    destination.write_bytes(png_data)


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    create_icon(180, ICON_DIR / "apple-touch-icon.png", maskable=False)
    create_icon(192, ICON_DIR / "icon-192.png", maskable=False)
    create_icon(512, ICON_DIR / "icon-512.png", maskable=False)
    create_icon(512, ICON_DIR / "icon-maskable-512.png", maskable=True)

    files = [
        "index.html",
        "style.css",
        "calc-engine.js",
        "app.js",
        "manifest.json",
        "service-worker.js",
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "oxanium.woff2",
        "literata.woff2",
        "jetbrains-mono.woff2",
        "POLICES-OFL.txt",
        "tools/build.py"
    ]

    missing = [name for name in files if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit(
            "Fichiers manquants : " + ", ".join(missing)
        )

    archive_path = ROOT / "omni-calculateur.zip"

    with zipfile.ZipFile(
        archive_path,
        "w",
        compression=zipfile.ZIP_DEFLATED
    ) as archive:
        for name in files:
            archive.write(
                ROOT / name,
                arcname=f"omni-calculateur/{name}"
            )

    print("Icônes générées et archive créée :", archive_path)


if __name__ == "__main__":
    main()
