/** A file the user brought in, kept as bytes so it survives a restart. */
export interface StoredFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

export type Align = 'left' | 'center'

/** Clockwise turn of the logo, in quarter turns of 90 degrees. */
export type Rotation = 0 | 90 | 180 | 270

export const ROTATIONS: Rotation[] = [0, 90, 180, 270]

/** What decides the finished size: the lengths as set, or a fixed overall height. */
export type SizeBy = 'settings' | 'height'

/**
 * Everything that defines a table. Lengths are in millimetres on the board; pixels only appear
 * once the layout is computed for a given DPI.
 */
export interface Doc {
  rows: string[]
  logo: StoredFile | null
  /** Id of a bundled font, or `CUSTOM_FONT` when `customFont` is in use. */
  font: string
  customFont: StoredFile | null
  /** Height of a capital letter. */
  textHeight: number
  align: Align
  lineWidth: number
  /** Space between the text and the lines around it. */
  padding: number
  /** Space between the logo and the lines around it. */
  logoPadding: number
  /** Cut away the transparent or white border the logo file comes with. */
  trimLogo: boolean
  logoRotation: Rotation
  /** Swap the logo's light and dark, on its own, before the rest of the table. */
  invertLogo: boolean
  /** White on black instead of black on white. */
  invert: boolean
  sizeBy: SizeBy
  /** Height of the whole table when `sizeBy` is `height`; every length is scaled to reach it. */
  height: number
  dpi: number
}

export const CUSTOM_FONT = 'custom'

export const DPI_MIN = 100
export const DPI_MAX = 2400

export function defaultDoc(): Doc {
  const month = new Date().toLocaleString('en', { month: 'long', year: 'numeric' })
  return {
    rows: ['Project name', month, 'By: Author', 'Rev: 1.0'],
    logo: null,
    font: 'dejavu-sans',
    customFont: null,
    textHeight: 1.5,
    align: 'left',
    lineWidth: 0.2,
    padding: 0.5,
    logoPadding: 0,
    trimLogo: true,
    logoRotation: 0,
    invertLogo: false,
    invert: false,
    sizeBy: 'settings',
    height: 10,
    dpi: 1200,
  }
}
