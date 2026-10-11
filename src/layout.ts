import type { Doc } from './model'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** One step of an outline, in the form opentype.js produces. */
export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' }

/** The table in whole pixels, ready to draw. Its outer lines are the edges of the image. */
export interface Layout {
  width: number
  height: number
  /** Filled bars; together they are every line of the table. */
  lines: Rect[]
  /** Where the logo picture goes, or null without a logo. */
  logo: Rect | null
  /** The letters of every row as filled outlines. */
  text: PathCommand[]
  pxPerMm: number
  /** The factor every length of the document was multiplied by; 1 unless the height is fixed. */
  scale: number
}

/** What the layout needs to know about the font and logo, so it stays free of canvas code. */
export interface Measures {
  /** Width of `text` set at `fontPx`. */
  textWidth: (text: string, fontPx: number) => number
  /** Outline of `text` set at `fontPx`, starting at `x` on `baseline`. */
  textPath: (text: string, x: number, baseline: number, fontPx: number) => PathCommand[]
  /** Height of a capital letter divided by the font size. */
  capRatio: number
  /** Logo width divided by its height, or null without a logo. */
  logoAspect: number | null
}

const MM_PER_INCH = 25.4

/**
 * Work out where everything goes. Every length is rounded to whole pixels once, here, and all
 * positions are sums of those, so lines, logo and text meet exactly with no seams between them.
 */
export function layoutTable(doc: Doc, measures: Measures, dpi = doc.dpi): Layout {
  const rows = doc.rows.length ? doc.rows : ['']

  // With a fixed height the table keeps its proportions and every length is scaled by the same
  // factor, the way an image is scaled when it is given a size.
  const natural = rows.length * (doc.textHeight + 2 * doc.padding) + (rows.length + 1) * doc.lineWidth
  const scale = doc.sizeBy === 'height' && natural > 0 ? doc.height / natural : 1

  let pxPerMm = dpi / MM_PER_INCH
  const px = (mm: number) => Math.max(0, Math.round(mm * scale * pxPerMm))

  const line = Math.max(1, px(doc.lineWidth))
  const pad = px(doc.padding)
  const cap = Math.max(1, px(doc.textHeight))
  const fontPx = cap / measures.capRatio

  // Every row has the same height and the same baseline, whatever letters it holds: capitals
  // are centred between the lines and descenders hang into the padding below.
  const rowHeight = cap + 2 * pad
  const widths = rows.map((text) => measures.textWidth(text, fontPx))
  const textWidth = Math.max(Math.ceil(Math.max(...widths)), cap) + 2 * pad

  // The image is exactly the table, with nothing around it: the size given to it in KiCad is
  // then the size of the table itself.
  const height = rows.length * rowHeight + (rows.length + 1) * line

  let logo: Rect | null = null
  let logoCell = 0
  if (measures.logoAspect) {
    const logoPad = px(doc.logoPadding)
    // The logo keeps at least one pixel of height even when the padding is set too large.
    const h = Math.max(1, height - 2 * line - 2 * logoPad)
    const w = Math.max(1, Math.round(h * measures.logoAspect))
    logoCell = w + 2 * logoPad
    logo = { x: line + logoPad, y: Math.round((height - h) / 2), w, h }
  }

  // With a logo there is one more vertical line, between it and the text.
  const textLeft = line + (logo ? logoCell + line : 0)
  const width = textLeft + textWidth + line

  const lines: Rect[] = [
    { x: 0, y: 0, w: width, h: line },
    { x: 0, y: height - line, w: width, h: line },
    { x: 0, y: 0, w: line, h: height },
    { x: width - line, y: 0, w: line, h: height },
  ]
  if (logo) lines.push({ x: textLeft - line, y: 0, w: line, h: height })

  const text: PathCommand[] = []
  rows.forEach((row, index) => {
    const rowTop = line + index * (rowHeight + line)
    if (index > 0) lines.push({ x: textLeft, y: rowTop - line, w: textWidth, h: line })
    const x = doc.align === 'center' ? textLeft + (textWidth - widths[index]) / 2 : textLeft + pad
    text.push(...measures.textPath(row, x, rowTop + pad + cap, fontPx))
  })

  // Rounding to whole pixels leaves the height a little off the one asked for. Declaring the
  // pixels very slightly larger or smaller makes it exact.
  if (doc.sizeBy === 'height') pxPerMm = height / doc.height

  return {
    width,
    height,
    lines,
    logo,
    text,
    pxPerMm,
    scale,
  }
}
