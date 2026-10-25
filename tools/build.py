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


def create_icon(size, destination):
    """Crée une icône simple avec une zone centrale compatible maskable."""
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

    # Corps de la calculatrice.
    rectangle(
        size * 0.27, size * 0.17,
        size * 0.73, size * 0.83,
        body
    )

    # Écran.
    rectangle(
        size * 0.32, size * 0.23,
        size * 0.68, size * 0.35,
        screen
    )

    # Grille de touches.
    left = size * 0.34
    top = size * 0.43
    key_width = size * 0.09
    key_height = size * 0.09
    gap = size * 0.035

    for row in range(3):
        for column in range(3):
            x0 = left + column * (key_width + gap)
            y0 = top + row * (key_height + gap)
            color = accent_key if (row == 2 and column == 2) else key

            rectangle(
                x0,
                y0,
                x0 + key_width,
                y0 + key_height,
                color
            )

    # Encodage PNG RGB, sans Pillow ni autre dépendance.
    raw_rows = []
    for row in pixels:
        raw_rows.append(
            b"\x00" + bytes(
                channel
                for pixel in row
                for channel in pixel
            )
        )

    header = struct.pack(
        ">IIBBBBB",
        size,
        size,
        8,  # profondeur : 8 bits
        2,  # couleur RGB
        0,
        0,
        0
    )

    png_data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(b"".join(raw_rows), 9))
        + png_chunk(b"IEND", b"")
    )

    destination.write_bytes(png_data)


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    create_icon(192, ICON_DIR / "icon-192.png")
    create_icon(512, ICON_DIR / "icon-512.png")

    files = [
        "index.html",
        "style.css",
        "app.js",
        "manifest.json",
        "service-worker.js",
        "icons/icon-192.png",
        "icons/icon-512.png",
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

    print("Icônes générées :")
    print(f"  {ICON_DIR / 'icon-192.png'}")
    print(f"  {ICON_DIR / 'icon-512.png'}")
    print(f"Archive créée : {archive_path}")


if __name__ == "__main__":
    main()