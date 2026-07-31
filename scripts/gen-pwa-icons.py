#!/usr/bin/env python3
"""Generate simple Cosmic Idle PWA icons (no external deps)."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def png_rgba(size: int, pixels: list[tuple[int, int, int, int]]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            r, g, b, a = pixels[y * size + x]
            raw.extend((r, g, b, a))

    return b''.join(
        [
            b'\x89PNG\r\n\x1a\n',
            chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)),
            chunk(b'IDAT', zlib.compress(bytes(raw), 9)),
            chunk(b'IEND', b''),
        ]
    )


def paint(size: int, *, maskable: bool = False) -> list[tuple[int, int, int, int]]:
    px = [(0, 0, 0, 0)] * (size * size)
    cx = cy = size / 2
    # Safe zone padding for maskable icons.
    pad = size * 0.18 if maskable else size * 0.08
    outer = size / 2 - pad

    def set_px(x: int, y: int, c: tuple[int, int, int, int]) -> None:
        if 0 <= x < size and 0 <= y < size:
            px[y * size + x] = c

    # Deep space background for maskable (fills full canvas).
    if maskable:
        for y in range(size):
            for x in range(size):
                t = (x + y) / (2 * size)
                set_px(x, y, (14 + int(8 * t), 18 + int(10 * t), 28 + int(12 * t), 255))

    # Soft nebula disc
    for y in range(size):
        for x in range(size):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d > outer:
                continue
            edge = max(0.0, 1.0 - d / outer)
            r = int(26 + 40 * edge)
            g = int(34 + 55 * edge)
            b = int(48 + 70 * edge)
            a = 255 if maskable else int(230 * min(1.0, edge * 1.4))
            set_px(x, y, (r, g, b, a))

    # Accent chevron / ship triangle pointing right
    ship_r = outer * 0.55
    for y in range(size):
        for x in range(size):
            dx = (x + 0.5 - cx) / ship_r
            dy = (y + 0.5 - cy) / ship_r
            # Triangle: tip at +0.9, base at -0.55
            if -0.55 <= dx <= 0.9 and abs(dy) <= 0.55 * (0.9 - dx) / 1.45:
                set_px(x, y, (224, 176, 106, 255))

    # Small orbit ring
    ring_r = outer * 0.78
    for y in range(size):
        for x in range(size):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            d = (dx * dx + dy * dy) ** 0.5
            if abs(d - ring_r) < size * 0.018:
                set_px(x, y, (126, 200, 255, 220 if not maskable else 255))

    return px


def main() -> None:
    out = Path(__file__).resolve().parents[1] / 'public'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'pwa-192.png').write_bytes(png_rgba(192, paint(192)))
    (out / 'pwa-512.png').write_bytes(png_rgba(512, paint(512)))
    (out / 'pwa-512-maskable.png').write_bytes(png_rgba(512, paint(512, maskable=True)))
    (out / 'apple-touch-icon.png').write_bytes(png_rgba(180, paint(180, maskable=True)))
    print('Wrote PWA icons to', out)


if __name__ == '__main__':
    main()
