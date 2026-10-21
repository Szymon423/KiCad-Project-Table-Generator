import { svgPath } from './export'
import { textPath, type TableFont } from './fonts'
import type { Rect } from './layout'
import type { StoredFile } from './model'

/** A decoded logo and the part of it that holds the actual artwork. */
export interface LogoImage {
  image: HTMLImageElement
  /** The artwork without its empty edges, in the image's own pixels. */
  content: Rect
}

/** The longest side the logo is scanned at; enough to find its edges to within a pixel or so. */
const SCAN_SIDE = 1024
/** Below this opacity a pixel counts as empty. Soft, half-transparent edge columns fall under it. */
const OPAQUE = 230
/** At or above this brightness in every channel a pixel counts as blank paper. */
const WHITE = 245

/** The size a word is outlined at; the picture is SVG, so it stays sharp at any size. */
const WORD_PX = 400

/**
 * A word set in `font` as a logo picture: black letters on transparent, cut tight around them.
 * It then goes through everything an image logo does, rotation and inversion included. Null for
 * an empty word.
 */
export async function wordLogo(font: TableFont, word: string): Promise<LogoImage | null> {
  const commands = textPath(font, word.trim(), 0, 0, WORD_PX)
  const points = commands.flatMap((c) => {
    if (c.type === 'Z') return []
    if (c.type === 'C') return [c.x1, c.y1, c.x2, c.y2, c.x, c.y]
    if (c.type === 'Q') return [c.x1, c.y1, c.x, c.y]
    return [c.x, c.y]
  })
  if (!points.length) return null
  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  const left = Math.floor(Math.min(...xs))
  const top = Math.floor(Math.min(...ys))
  const width = Math.ceil(Math.max(...xs)) - left
  const height = Math.ceil(Math.max(...ys)) - top
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}">` +
    `<path fill="#000" d="${svgPath(commands)}"/></svg>`
  return decodeLogo({ name: word, type: 'image/svg+xml', bytes: new TextEncoder().encode(svg).buffer })
}

export async function decodeLogo(file: StoredFile): Promise<LogoImage> {
  // An <img> rather than createImageBitmap, because it also takes SVG and scales it sharply.
  const image = new Image()
  image.src = URL.createObjectURL(new Blob([file.bytes], { type: file.type }))
  await image.decode()
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('The image has no size')
  return { image, content: findContent(image) }
}

/**
 * Find the box around the artwork, leaving out edges that are transparent or white. Logo files
 * often carry such a border, sometimes a single half-transparent column from anti-aliasing,
 * and it would show as an uneven gap between the logo and the lines of the table.
 */
function findContent(image: HTMLImageElement): Rect {
  const full = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  const scale = Math.min(1, SCAN_SIDE / Math.max(full.w, full.h))
  const width = Math.max(1, Math.round(full.w * scale))
  const height = Math.max(1, Math.round(full.h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  const filled = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i + 3] >= OPAQUE && (data[i] < WHITE || data[i + 1] < WHITE || data[i + 2] < WHITE)
  }
  const columnFilled = (x: number) => {
    for (let y = 0; y < height; y++) if (filled(x, y)) return true
    return false
  }
  const rowFilled = (y: number) => {
    for (let x = 0; x < width; x++) if (filled(x, y)) return true
    return false
  }

  let left = 0
  let right = width - 1
  let top = 0
  let bottom = height - 1
  while (left < right && !columnFilled(left)) left++
  while (right > left && !columnFilled(right)) right--
  while (top < bottom && !rowFilled(top)) top++
  while (bottom > top && !rowFilled(bottom)) bottom--
  // Nothing counted as artwork (a very faint or all-white logo): leave the image as it is.
  if (left === right || top === bottom) return full

  return {
    x: left / scale,
    y: top / scale,
    w: (right - left + 1) / scale,
    h: (bottom - top + 1) / scale,
  }
}
