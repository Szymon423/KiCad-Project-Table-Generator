import { parse, type Font, type Glyph } from 'opentype.js'
import type { PathCommand } from './layout'

export interface BundledFont {
  id: string
  label: string
  file: string
}

/** Fonts shipped with the app. All are free to redistribute; see public/fonts/. */
export const FONTS: BundledFont[] = [
  { id: 'dejavu-sans', label: 'DejaVu Sans', file: 'DejaVuSans.ttf' },
  { id: 'dejavu-sans-bold', label: 'DejaVu Sans Bold', file: 'DejaVuSans-Bold.ttf' },
  { id: 'dejavu-sans-condensed', label: 'DejaVu Sans Condensed', file: 'DejaVuSansCondensed.ttf' },
  { id: 'liberation-sans', label: 'Liberation Sans', file: 'LiberationSans-Regular.ttf' },
  { id: 'liberation-sans-bold', label: 'Liberation Sans Bold', file: 'LiberationSans-Bold.ttf' },
]

/**
 * A parsed font. Text is laid out and outlined from the font file itself, not by the browser,
 * so the preview, the PNG and the SVG all get exactly the same letter shapes.
 */
export interface TableFont {
  font: Font
  /** Spacing correction between two neighbouring glyphs, in font units. */
  kerning: (left: Glyph, right: Glyph) => number
  /** Height of a capital letter divided by the font size. */
  capRatio: number
}

/** The part of opentype.js that reads kerning from the GPOS table; its typings leave it out. */
interface Position {
  getKerningTables: (script: string, language: string) => unknown[] | undefined
  getKerningValue: (tables: unknown[], left: number, right: number) => number
}

/** Parse a font file. Throws when the bytes are not a font opentype.js can read. */
export function parseFont(bytes: ArrayBuffer): TableFont {
  const font = parse(bytes)
  const position = (font as unknown as { position?: Position }).position
  // Fonts file their kerning under the Latin script more often than under the default one,
  // which is the only place opentype.js looks on its own.
  const tables = ['latn', 'DFLT']
    .map((script) => position?.getKerningTables(script, 'dflt'))
    .find((found) => found?.length)
  const kerning = (left: Glyph, right: Glyph) =>
    (tables && position!.getKerningValue(tables, left.index, right.index)) ||
    font.getKerningValue(left, right)

  const capHeight = font.charToGlyph('H').getMetrics().yMax
  return { font, kerning, capRatio: capHeight > 0 ? capHeight / font.unitsPerEm : 0.7 }
}

const bundled = new Map<string, Promise<TableFont>>()

/** Fetch and parse a bundled font once. */
export function loadBundledFont(id: string): Promise<TableFont> {
  const entry = FONTS.find((candidate) => candidate.id === id) ?? FONTS[0]
  let loading = bundled.get(entry.id)
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}fonts/${entry.file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not fetch ${entry.file}`)
        return response.arrayBuffer()
      })
      .then(parseFont)
    bundled.set(entry.id, loading)
  }
  return loading
}

/**
 * Walk the glyphs of a line of text, left to right, with kerning applied. Deliberately simple
 * (no ligatures, no right-to-left): the shaping code in opentype.js fails on some fonts.
 */
function eachGlyph(
  { font, kerning }: TableFont,
  text: string,
  px: number,
  visit?: (glyph: Glyph, x: number) => void,
): number {
  const scale = px / font.unitsPerEm
  let x = 0
  let previous: Glyph | null = null
  for (const char of text) {
    const glyph = font.charToGlyph(char)
    if (previous) x += kerning(previous, glyph) * scale
    visit?.(glyph, x)
    x += (glyph.advanceWidth ?? 0) * scale
    previous = glyph
  }
  return x
}

export const textWidth = (font: TableFont, text: string, px: number) => eachGlyph(font, text, px)

/** The outline of `text`, starting at `x` on the given baseline. */
export function textPath(font: TableFont, text: string, x: number, baseline: number, px: number): PathCommand[] {
  const commands: PathCommand[] = []
  eachGlyph(font, text, px, (glyph, offset) => {
    commands.push(...(glyph.getPath(x + offset, baseline, px).commands as PathCommand[]))
  })
  return commands
}
