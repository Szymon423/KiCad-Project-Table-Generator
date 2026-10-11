import type { TableFont } from './fonts'
import type { Layout, PathCommand } from './layout'
import type { LogoImage } from './logo'

/** What the document refers to, decoded and ready to draw with. */
export interface Resources {
  logo: LogoImage | null
  font: TableFont | null
}

export interface Look {
  invert: boolean
  trimLogo: boolean
}

/** Ink and paper colours, swapped when the table is inverted. */
export const colours = (invert: boolean) =>
  invert ? { ink: '#fff', paper: '#000' } : { ink: '#000', paper: '#fff' }

/**
 * The logo as it appears in the table: scaled to its place, on paper colour, inverted if the
 * table is. Every output format places this same picture. Null without a logo.
 */
export function logoPicture(layout: Layout, logo: LogoImage | null, look: Look): HTMLCanvasElement | null {
  if (!layout.logo || !logo) return null
  const { w, h } = layout.logo
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  const { image, content } = logo
  const source = look.trimLogo ? content : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  ctx.drawImage(image, source.x, source.y, source.w, source.h, 0, 0, w, h)
  if (look.invert) {
    // White minus every pixel: black becomes white and the other way round.
    ctx.globalCompositeOperation = 'difference'
    ctx.fillRect(0, 0, w, h)
  }
  return canvas
}

function trace(ctx: CanvasRenderingContext2D, commands: PathCommand[]): void {
  ctx.beginPath()
  for (const c of commands) {
    if (c.type === 'M') ctx.moveTo(c.x, c.y)
    else if (c.type === 'L') ctx.lineTo(c.x, c.y)
    else if (c.type === 'Q') ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y)
    else if (c.type === 'C') ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y)
    else ctx.closePath()
  }
}

/** Draw the table onto a canvas sized to the layout. */
export function renderTable(canvas: HTMLCanvasElement, layout: Layout, resources: Resources, look: Look): void {
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')!
  const { ink, paper } = colours(look.invert)

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, layout.width, layout.height)

  const picture = logoPicture(layout, resources.logo, look)
  if (picture && layout.logo) ctx.drawImage(picture, layout.logo.x, layout.logo.y)

  ctx.fillStyle = ink
  for (const { x, y, w, h } of layout.lines) ctx.fillRect(x, y, w, h)
  trace(ctx, layout.text)
  ctx.fill('nonzero')
}
