// Convert a company logo URL into ESC/POS raster bytes (`GS v 0`).
// The ticket builder prepends the returned Uint8Array to the header
// block; on any failure this returns an empty array so the builder
// silently falls back to a text-only header (per the user's
// "pug-n-play" expectation — a missing logo must never block a sale).
//
// Pipeline:
//   1. fetch → blob → ImageBitmap
//   2. Draw to <canvas> scaled to target width, proportional height
//   3. Grayscale + Floyd–Steinberg dither to 1 bit per pixel
//   4. Pack MSB-first, `GS v 0 m xL xH yL yH ...` header, centered
//
// Command reference: ESC/POS `GS v 0` (1D 76 30). `m = 0` = normal
// density. Byte 4/5 is bytes-per-row (little-endian). Byte 6/7 is
// rows. Widely supported on cheap 80mm printers; if a specific
// printer rejects it we can swap to `GS ( L` without touching the
// dither pipeline.

import { C, concat } from './escpos'

const LF = 0x0a
const MAX_DOTS_HIGH = 256 // guardrail so a tall logo doesn't hog paper

// Module-level cache keyed by `${url}|${targetDotsWide}`. One Map per
// tab; entries survive POS route navigation but reset on reload — which
// is the right granularity (refreshing the tab also re-authorizes the
// printer, so a fresh logo fetch is in keeping).
const logoCache = new Map<string, Uint8Array>()

export async function fetchAndDitherLogo(
  logoUrl: string,
  targetDotsWide = 384
): Promise<Uint8Array> {
  const cacheKey = `${logoUrl}|${targetDotsWide}`
  const cached = logoCache.get(cacheKey)
  if (cached) return cached

  try {
    const bytes = await renderLogoBytes(logoUrl, targetDotsWide)
    logoCache.set(cacheKey, bytes)
    return bytes
  } catch {
    // Silent fallback — cache the empty result too so a broken
    // logo_url doesn't thrash the network on every print.
    const empty = new Uint8Array(0)
    logoCache.set(cacheKey, empty)
    return empty
  }
}

async function renderLogoBytes(logoUrl: string, targetDotsWide: number): Promise<Uint8Array> {
  const response = await fetch(logoUrl, { mode: 'cors' })
  if (!response.ok) throw new Error(`logo fetch ${response.status}`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  try {
    if (bitmap.width === 0 || bitmap.height === 0) throw new Error('empty image')

    // Round width down to a multiple of 8 so we pack whole bytes with
    // no trailing padding bits (cleaner and avoids the last column
    // being half-dithered noise).
    const widthDots = Math.max(8, Math.floor(targetDotsWide / 8) * 8)
    const heightDots = Math.min(
      MAX_DOTS_HIGH,
      Math.max(1, Math.round(bitmap.height * (widthDots / bitmap.width)))
    )

    const canvas = document.createElement('canvas')
    canvas.width = widthDots
    canvas.height = heightDots
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context')
    // Fill white so alpha-transparent regions print as background,
    // not as stray black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, widthDots, heightDots)
    ctx.drawImage(bitmap, 0, 0, widthDots, heightDots)

    const imageData = ctx.getImageData(0, 0, widthDots, heightDots)
    const pixels = imageData.data // RGBA, row-major

    // Convert to a mutable grayscale buffer (one byte per pixel) so
    // Floyd–Steinberg can propagate float-like error values without
    // extra arithmetic. Premultiply alpha against white so
    // semi-transparent logos stay readable after thresholding.
    const gray = new Int16Array(widthDots * heightDots)
    for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
      const a = pixels[i + 3] / 255
      const r = pixels[i] * a + 255 * (1 - a)
      const g = pixels[i + 1] * a + 255 * (1 - a)
      const b = pixels[i + 2] * a + 255 * (1 - a)
      gray[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    }

    // Floyd–Steinberg error diffusion. Output stays in `gray`: each
    // pixel becomes 0 (black) or 255 (white). Errors spill into
    // neighbors so solid gradients render as distributed dots rather
    // than abrupt bands.
    for (let y = 0; y < heightDots; y++) {
      for (let x = 0; x < widthDots; x++) {
        const idx = y * widthDots + x
        const old = gray[idx]
        const quantized = old < 128 ? 0 : 255
        gray[idx] = quantized
        const err = old - quantized
        if (x + 1 < widthDots) gray[idx + 1] += Math.round((err * 7) / 16)
        if (y + 1 < heightDots) {
          if (x > 0) gray[idx + widthDots - 1] += Math.round((err * 3) / 16)
          gray[idx + widthDots] += Math.round((err * 5) / 16)
          if (x + 1 < widthDots) gray[idx + widthDots + 1] += Math.round((err * 1) / 16)
        }
      }
    }

    // Pack MSB-first: bit=1 ⇒ print (black). 0 after dither = black,
    // 255 = white. One byte spans 8 horizontal pixels.
    const bytesPerRow = widthDots / 8
    const bitmapBytes = new Uint8Array(bytesPerRow * heightDots)
    for (let y = 0; y < heightDots; y++) {
      for (let xByte = 0; xByte < bytesPerRow; xByte++) {
        let byte = 0
        for (let bit = 0; bit < 8; bit++) {
          const px = gray[y * widthDots + xByte * 8 + bit]
          if (px === 0) byte |= 1 << (7 - bit)
        }
        bitmapBytes[y * bytesPerRow + xByte] = byte
      }
    }

    // GS v 0 m xL xH yL yH. m=0 is normal density. xL/xH is bytes per
    // row; yL/yH is row count. Both little-endian two-byte ints.
    const header = Uint8Array.from([
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      heightDots & 0xff,
      (heightDots >> 8) & 0xff,
    ])

    return concat(C.ALIGN_C, header, bitmapBytes, Uint8Array.from([LF]), C.ALIGN_L)
  } finally {
    // Always release the bitmap's underlying resources.
    bitmap.close()
  }
}
