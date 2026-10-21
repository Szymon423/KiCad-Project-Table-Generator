import type { Layout, PathCommand } from './layout'
import { colours } from './render'

const canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), 'image/png'),
  )

// --- PNG ---

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** The 8-byte signature plus the IHDR chunk, which always comes first and is 25 bytes long. */
const AFTER_IHDR = 8 + 25

/**
 * Add a pHYs chunk, which records the pixel density. The canvas encoder leaves it out, and
 * without it a program opening the file cannot tell how large the table is meant to be.
 */
function withDensity(png: Uint8Array, dpi: number): Uint8Array {
  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  const perMetre = Math.round(dpi / 0.0254)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, perMetre)
  view.setUint32(12, perMetre)
  view.setUint8(16, 1) // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)))

  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, AFTER_IHDR))
  out.set(chunk, AFTER_IHDR)
  out.set(png.subarray(AFTER_IHDR), AFTER_IHDR + chunk.length)
  return out
}

/** The canvas as a PNG file that carries its DPI. */
export async function pngBlob(canvas: HTMLCanvasElement, dpi: number): Promise<Blob> {
  const png = new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer())
  return new Blob([withDensity(png, dpi) as BlobPart], { type: 'image/png' })
}

// --- SVG ---

/** What the SVG exporter draws: the layout, plus the logo already rendered for it. */
export interface Drawing {
  layout: Layout
  logo: HTMLCanvasElement | null
  invert: boolean
}

/** Two decimals of a pixel is far finer than anything that can be manufactured. */
const n = (value: number) => String(Math.round(value * 100) / 100)

export function svgPath(commands: PathCommand[]): string {
  return commands
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
      return 'Z'
    })
    .join('')
}

/**
 * The table as SVG, sized in millimetres. Lines and letters are filled paths, so no font is
 * needed to open it. There is no background in the normal look, only ink.
 */
export function svgBlob({ layout, logo, invert }: Drawing): Blob {
  const { width, height, pxPerMm } = layout
  const { ink, paper } = colours(invert)
  const lines = layout.lines.map(({ x, y, w, h }) => `M${x} ${y}h${w}v${h}h${-w}Z`).join('')
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width / pxPerMm)}mm" height="${n(height / pxPerMm)}mm" viewBox="0 0 ${width} ${height}">`,
  ]
  if (invert) parts.push(`<rect width="${width}" height="${height}" fill="${paper}"/>`)
  if (logo && layout.logo) {
    const { x, y, w, h } = layout.logo
    parts.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${logo.toDataURL('image/png')}"/>`)
  }
  parts.push(`<path fill="${ink}" d="${lines}"/>`)
  if (layout.text.length) parts.push(`<path fill="${ink}" d="${svgPath(layout.text)}"/>`)
  parts.push('</svg>')
  return new Blob([parts.join('\n')], { type: 'image/svg+xml' })
}

/** A file name taken from the first row that has text, like `table-sensor-programmer`. */
export function suggestedName(rows: string[]): string {
  const first = rows.find((row) => row.trim()) ?? ''
  const slug = first
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `table-${slug}` : 'table'
}
