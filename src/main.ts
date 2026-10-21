import './style.css'
import { pngBlob, suggestedName, svgBlob, type Drawing } from './export'
import { copyImage, copyText, pickFile, saveFile, type FileType } from './files'
import { FONTS, loadBundledFont, parseFont, textPath, textWidth } from './fonts'
import { footprintText } from './footprint'
import { layoutTable, type Layout } from './layout'
import { decodeLogo } from './logo'
import { CUSTOM_FONT, DPI_MAX, DPI_MIN, ROTATIONS, defaultDoc, type Doc, type StoredFile } from './model'
import { PROJECT_EXTENSION, isProjectFile, parseProject, serializeProject } from './project'
import { logoPicture, renderTable, type Resources } from './render'
import { rowList } from './rows'
import { loadDoc, saveDoc } from './storage'

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

const canvas = $<HTMLCanvasElement>('#canvas')
const preview = $('#preview')
const sizeLabel = $('#size')
const status = $('#status')
const fontSelect = $<HTMLSelectElement>('#font')
const numberInputs = [...document.querySelectorAll<HTMLInputElement>('input[data-field]')]

type NumberField = 'textHeight' | 'lineWidth' | 'padding' | 'logoPadding' | 'height' | 'dpi'

/** Canvases beyond this many pixels a side fail in some browsers, so the resolution is capped. */
const MAX_SIDE = 12000
/** Room left around the table in the preview, in CSS pixels. */
const PREVIEW_GAP = 64

let doc = defaultDoc()
const resources: Resources = { logo: null, font: null }
/** The layout on screen and the DPI it was drawn at, which is what an export writes. */
let current: { layout: Layout; dpi: number } | null = null

// --- drawing ---

let pending = false

/** Redraw on the next frame; several changes in one go cost one redraw. */
function refresh(): void {
  if (pending) return
  pending = true
  requestAnimationFrame(() => {
    pending = false
    draw()
    scheduleSave()
  })
}

/** Lay the document out at `wanted` DPI, or at the highest DPI that still fits a canvas. */
function layoutAt(wanted: number): { layout: Layout; dpi: number } | null {
  const font = resources.font
  if (!font) return null
  const measures = {
    textWidth: (text: string, px: number) => textWidth(font, text, px),
    textPath: (text: string, x: number, baseline: number, px: number) => textPath(font, text, x, baseline, px),
    capRatio: font.capRatio,
    logoAspect: logoAspect(),
  }
  let dpi = wanted
  let layout = layoutTable(doc, measures, dpi)
  const longest = Math.max(layout.width, layout.height)
  if (longest > MAX_SIDE) {
    dpi = Math.floor((dpi * MAX_SIDE) / longest)
    layout = layoutTable(doc, measures, dpi)
  }
  return { layout, dpi }
}

function draw(): void {
  current = layoutAt(doc.dpi)
  if (!current) return
  const { layout, dpi } = current
  renderTable(canvas, layout, resources, doc)
  fitPreview()

  const mm = (px: number) => (px / layout.pxPerMm).toFixed(1)
  // With a fixed height the other lengths are proportions, so say what they come out as.
  const real = (value: number) => (value * layout.scale).toFixed(2)
  $('#scale-hint').textContent =
    `Scaled ×${layout.scale.toFixed(2)}: letters ${real(doc.textHeight)} mm, lines ${real(doc.lineWidth)} mm`
  const limited = dpi < doc.dpi ? ` · limited to ${dpi} dpi` : ''
  sizeLabel.textContent = `${mm(layout.width)} × ${mm(layout.height)} mm · ${layout.width} × ${layout.height} px${limited}`
}

/** Scale the canvas to fill the preview area, whatever resolution it was drawn at. */
function fitPreview(): void {
  if (!current) return
  const { width, height } = current.layout
  const scale = Math.min(
    (preview.clientWidth - 2 * PREVIEW_GAP) / width,
    (preview.clientHeight - 2 * PREVIEW_GAP) / height,
  )
  canvas.style.width = `${Math.max(1, width * scale)}px`
  canvas.style.height = `${Math.max(1, height * scale)}px`
}

// --- remembering the last session ---

let saveTimer = 0

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveDoc(doc), 400)
}

// --- status line ---

let statusTimer = 0

function say(message: string): void {
  status.textContent = message
  status.hidden = false
  clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => (status.hidden = true), 3500)
}

// --- logo ---

/** Width of the logo divided by its height, as it will be drawn. */
function logoAspect(): number | null {
  if (!resources.logo) return null
  const { image, content } = resources.logo
  const aspect = doc.trimLogo ? content.w / content.h : image.naturalWidth / image.naturalHeight
  // A quarter turn swaps width and height.
  return doc.logoRotation === 90 || doc.logoRotation === 270 ? 1 / aspect : aspect
}

/** A logo the user just brought in starts upright and uninverted, whatever the last one was. */
async function newLogo(file: File): Promise<void> {
  doc.logoRotation = 0
  doc.invertLogo = false
  await setLogo(await stored(file))
  showForm()
}

async function setLogo(file: StoredFile | null): Promise<void> {
  try {
    resources.logo = file ? await decodeLogo(file) : null
    doc.logo = file
  } catch {
    say(`Could not read ${file?.name ?? 'the logo'} as an image`)
    // A remembered logo that no longer decodes must not linger in the saved document.
    if (!resources.logo) doc.logo = null
  }
  showLogo()
  refresh()
}

function showLogo(): void {
  $('#logo-thumb').style.backgroundImage = resources.logo ? `url("${resources.logo.image.src}")` : ''
  $('#logo-name').textContent = doc.logo?.name ?? 'No logo'
  $<HTMLButtonElement>('#logo-remove').hidden = !doc.logo
  const thumb = $('#logo-thumb')
  thumb.style.transform = `rotate(${doc.logoRotation}deg)`
  thumb.style.filter = doc.invertLogo ? 'invert(1)' : ''
  $('#logo-rotation').textContent = `${doc.logoRotation}°`
  for (const control of document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.logo-only')) {
    control.disabled = !doc.logo
  }
}

const stored = async (file: File): Promise<StoredFile> => ({
  name: file.name,
  type: file.type,
  bytes: await file.arrayBuffer(),
})

async function sampleLogo(): Promise<StoredFile | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sample-logo.png`)
    if (!response.ok) return null
    return { name: 'Sample logo', type: 'image/png', bytes: await response.arrayBuffer() }
  } catch {
    return null
  }
}

// --- font ---

function showFonts(): void {
  const options = FONTS.map((font) => new Option(font.label, font.id))
  if (doc.customFont) options.push(new Option(doc.customFont.name, CUSTOM_FONT))
  fontSelect.replaceChildren(...options)
  fontSelect.value = doc.font
}

/** Load the font the document names and redraw. Falls back to the default font on failure. */
async function applyFont(): Promise<void> {
  try {
    resources.font =
      doc.font === CUSTOM_FONT && doc.customFont
        ? parseFont(doc.customFont.bytes)
        : await loadBundledFont(doc.font)
  } catch {
    say('Could not load that font')
    doc.font = FONTS[0].id
    resources.font = await loadBundledFont(doc.font)
  }
  showFonts()
  refresh()
}

async function setCustomFont(file: StoredFile): Promise<void> {
  try {
    // Checked before it replaces the font in use, so a bad file changes nothing.
    parseFont(file.bytes)
  } catch {
    say(`${file.name} is not a font this app can use`)
    return
  }
  doc.customFont = file
  doc.font = CUSTOM_FONT
  await applyFont()
}

// --- the form ---

const rows = rowList(
  $('#rows'),
  () => doc.rows,
  (next) => {
    doc.rows = next
    refresh()
  },
)

function showForm(): void {
  rows.draw()
  for (const input of numberInputs) input.value = String(doc[input.dataset.field as NumberField])
  $<HTMLInputElement>('#invert').checked = doc.invert
  $<HTMLInputElement>('#trim-logo').checked = doc.trimLogo
  $<HTMLInputElement>('#invert-logo').checked = doc.invertLogo
  for (const button of document.querySelectorAll<HTMLElement>('#size-by button')) {
    button.classList.toggle('active', button.dataset.sizeBy === doc.sizeBy)
  }
  $('#height-field').hidden = $('#scale-hint').hidden = doc.sizeBy !== 'height'
  for (const button of document.querySelectorAll<HTMLElement>('#align button')) {
    button.classList.toggle('active', button.dataset.align === doc.align)
  }
  showFonts()
  showLogo()
}

for (const input of numberInputs) {
  const field = input.dataset.field as NumberField
  input.addEventListener('input', () => {
    // A half-typed or out-of-range number is left alone until it becomes valid. A value between
    // two arrow steps (11.2 with a step of 0.5) is valid, although the browser flags it.
    const { badInput, rangeUnderflow, rangeOverflow } = input.validity
    if (input.value === '' || badInput || rangeUnderflow || rangeOverflow) return
    doc[field] = input.valueAsNumber
    refresh()
  })
  input.addEventListener('blur', () => (input.value = String(doc[field])))
}

$('#add-row').addEventListener('click', () => rows.add())

for (const [selector, field] of [
  ['#invert', 'invert'],
  ['#trim-logo', 'trimLogo'],
  ['#invert-logo', 'invertLogo'],
] as const) {
  $<HTMLInputElement>(selector).addEventListener('change', (event) => {
    doc[field] = (event.target as HTMLInputElement).checked
    refresh()
  })
}

$('#logo-rotate').addEventListener('click', () => {
  doc.logoRotation = ROTATIONS[(ROTATIONS.indexOf(doc.logoRotation) + 1) % ROTATIONS.length]
  showLogo()
  refresh()
})

$('#size-by').addEventListener('click', (event) => {
  const sizeBy = (event.target as HTMLElement).closest<HTMLElement>('[data-size-by]')?.dataset.sizeBy
  if ((sizeBy !== 'settings' && sizeBy !== 'height') || sizeBy === doc.sizeBy) return
  // Fixing the height starts from the height the table has now, so nothing jumps.
  if (sizeBy === 'height' && current) {
    const height = Math.round((current.layout.height / current.layout.pxPerMm) * 10) / 10
    doc.height = Math.min(500, Math.max(1, height))
  }
  doc.sizeBy = sizeBy
  showForm()
  refresh()
})

$('#align').addEventListener('click', (event) => {
  const align = (event.target as HTMLElement).closest<HTMLElement>('[data-align]')?.dataset.align
  if (align !== 'left' && align !== 'center') return
  doc.align = align
  showForm()
  refresh()
})

fontSelect.addEventListener('change', () => {
  doc.font = fontSelect.value
  void applyFont()
})

const FILE_TYPES = {
  logo: { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp'] },
  font: { name: 'Fonts', extensions: ['ttf', 'otf', 'woff'] },
  project: { name: 'Table project', extensions: [PROJECT_EXTENSION] },
  png: { name: 'PNG image', extensions: ['png'] },
  svg: { name: 'SVG image', extensions: ['svg'] },
  kicad_mod: { name: 'KiCad footprint', extensions: ['kicad_mod'] },
} satisfies Record<string, FileType>

$('#logo-pick').addEventListener('click', async () => {
  const file = await pickFile(FILE_TYPES.logo)
  if (file) await newLogo(file)
})
$('#font-pick').addEventListener('click', async () => {
  const file = await pickFile(FILE_TYPES.font)
  if (file) await setCustomFont(await stored(file))
})
$('#logo-remove').addEventListener('click', () => void setLogo(null))

// --- output ---

/** Run an output action and report how it went in the status line. */
async function run(action: () => Promise<string | null>, failure: string): Promise<void> {
  try {
    const message = await action()
    if (message) say(message)
  } catch (error) {
    console.error(error)
    say(failure)
  }
}

/** Save under a name taken from the first row. Null, and so no message, when cancelled. */
async function save(blob: Blob, type: FileType): Promise<string | null> {
  const saved = await saveFile(blob, `${suggestedName(doc.rows)}.${type.extensions[0]}`, type)
  return saved && `Saved ${saved}`
}

/** The density to record in a PNG; with a fixed height it is not exactly the DPI asked for. */
const pngDpi = (layout: Layout) => layout.pxPerMm * 25.4

/** What the SVG export draws: the layout on screen and the logo rendered for it. */
function drawing(shown: { layout: Layout }): Drawing {
  return { layout: shown.layout, logo: logoPicture(shown.layout, resources.logo, doc), invert: doc.invert }
}

/**
 * The footprint is traced from its own rendering at a fixed, fine resolution, so its accuracy
 * does not depend on the DPI chosen for the PNG.
 */
const FOOTPRINT_DPI = 2400

function footprint(): string | null {
  const fine = layoutAt(FOOTPRINT_DPI)
  if (!fine) return null
  const scratch = document.createElement('canvas')
  renderTable(scratch, fine.layout, resources, doc)
  const image = scratch.getContext('2d')!.getImageData(0, 0, scratch.width, scratch.height)
  return footprintText(image, fine.layout.pxPerMm, suggestedName(doc.rows))
}

const OUTPUTS: Record<string, () => Promise<void>> = {
  kicad: () =>
    run(async () => {
      const text = footprint()
      if (!text) return null
      await copyText(text)
      return 'Copied as a footprint. Paste it in the KiCad PCB editor'
    }, 'Could not copy the footprint'),
  footprint: () =>
    run(async () => {
      const text = footprint()
      return text && save(new Blob([text], { type: 'text/plain' }), FILE_TYPES.kicad_mod)
    }, 'Could not export the footprint'),
  copy: () =>
    run(async () => {
      if (!current) return null
      await copyImage(await pngBlob(canvas, pngDpi(current.layout)))
      return 'Copied to the clipboard'
    }, 'Could not copy to the clipboard'),
  png: () =>
    run(async () => current && save(await pngBlob(canvas, pngDpi(current.layout)), FILE_TYPES.png), 'Could not export the PNG'),
  svg: () => run(async () => current && save(svgBlob(drawing(current)), FILE_TYPES.svg), 'Could not export the SVG'),
  save: () => run(async () => save(serializeProject(doc), FILE_TYPES.project), 'Could not save the project'),
}

const outputMenu = $('#output')
/** Hide the menu after a choice; hovering alone would keep it open until the pointer leaves. */
function closeOutputMenu(): void {
  outputMenu.classList.remove('open')
  outputMenu.classList.add('dismissed')
}
outputMenu.addEventListener('pointerleave', () => outputMenu.classList.remove('dismissed'))
// Hover opens the menu; a click does too, for touch screens and for anyone who expects one.
$('#output-button').addEventListener('click', () => {
  outputMenu.classList.remove('dismissed')
  outputMenu.classList.toggle('open')
})
window.addEventListener('pointerdown', (event) => {
  if (!outputMenu.contains(event.target as Node)) outputMenu.classList.remove('open')
})
for (const item of outputMenu.querySelectorAll<HTMLButtonElement>('[data-output]')) {
  item.addEventListener('click', () => {
    closeOutputMenu()
    void OUTPUTS[item.dataset.output!]()
  })
}

function confirm(message: string, action: string): Promise<boolean> {
  const dialog = $<HTMLDialogElement>('#confirm')
  dialog.querySelector('p')!.textContent = message
  const buttons = [...dialog.querySelectorAll('button')]
  buttons[1].textContent = action
  return new Promise((resolve) => {
    let answer = false
    for (const button of buttons) {
      button.onclick = () => {
        answer = button.value === 'ok'
        dialog.close()
      }
    }
    // Escape closes the dialog without a click, which counts as Cancel.
    dialog.onclose = () => resolve(answer)
    dialog.showModal()
  })
}

/** Replace the whole document and bring the form, logo and font in line with it. */
async function load(next: Doc): Promise<void> {
  doc = next
  showForm()
  await Promise.all([setLogo(doc.logo), applyFont()])
}

async function reset(): Promise<void> {
  if (!(await confirm('Reset the rows, the logo and every setting to the defaults?', 'Reset'))) return
  await load({ ...defaultDoc(), logo: await sampleLogo() })
}

async function openProject(file: File): Promise<void> {
  let next: Doc
  try {
    next = restore(parseProject(await file.text()))
  } catch {
    say(`${file.name} is not a table project`)
    return
  }
  // The table on screen exists nowhere else unless it was saved, so it is not replaced silently.
  if (!(await confirm(`Open ${file.name}? It replaces the table you have now.`, 'Open'))) return
  await load(next)
  say(`Opened ${file.name}`)
}

async function pickProject(): Promise<void> {
  const file = await pickFile(FILE_TYPES.project)
  if (file) await openProject(file)
}

$('#open').addEventListener('click', () => void pickProject())
$('#reset').addEventListener('click', () => void reset())

window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    void OUTPUTS.save()
  } else if (key === 'e') {
    event.preventDefault()
    void OUTPUTS.png()
  } else if (key === 'o') {
    event.preventDefault()
    void pickProject()
  } else if (key === 'k') {
    event.preventDefault()
    void OUTPUTS.kicad()
  } else if (key === 'c' && !hasTextSelection()) {
    event.preventDefault()
    void OUTPUTS.copy()
  }
})

/** True when Ctrl+C should copy selected text as usual, not the image. */
function hasTextSelection(): boolean {
  const active = document.activeElement
  if (active instanceof HTMLInputElement && active.type === 'text') {
    return active.selectionStart !== active.selectionEnd
  }
  return false
}

// --- paste and drop ---

const FONT_FILE = /\.(ttf|otf|woff)$/i

async function take(file: File): Promise<void> {
  if (isProjectFile(file.name)) await openProject(file)
  else if (FONT_FILE.test(file.name)) await setCustomFont(await stored(file))
  else if (file.type.startsWith('image/')) await newLogo(file)
  else say(`${file.name} is not a project, an image or a font`)
}

window.addEventListener('paste', (event) => {
  const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
  if (!file) return
  event.preventDefault()
  void take(file)
})

window.addEventListener('dragover', (event) => {
  event.preventDefault()
  document.body.classList.add('drop-target')
})
window.addEventListener('dragleave', () => document.body.classList.remove('drop-target'))
window.addEventListener('drop', (event) => {
  event.preventDefault()
  document.body.classList.remove('drop-target')
  const file = event.dataTransfer?.files[0]
  if (file) void take(file)
})

new ResizeObserver(fitPreview).observe(preview)

// --- start ---

/** Take what a previous version saved, keeping only values that still make sense. */
function restore(saved: Partial<Doc>): Doc {
  const base = defaultDoc()
  const merged = { ...base, ...saved }
  if (!Array.isArray(merged.rows) || !merged.rows.length) merged.rows = base.rows
  for (const input of numberInputs) {
    const field = input.dataset.field as NumberField
    const value = merged[field]
    if (typeof value !== 'number' || value < Number(input.min) || value > Number(input.max)) {
      merged[field] = base[field]
    }
  }
  merged.dpi = Math.min(DPI_MAX, Math.max(DPI_MIN, merged.dpi))
  merged.invert = merged.invert === true
  merged.trimLogo = merged.trimLogo !== false
  merged.invertLogo = merged.invertLogo === true
  if (!ROTATIONS.includes(merged.logoRotation)) merged.logoRotation = base.logoRotation
  if (merged.font === CUSTOM_FONT ? !merged.customFont : !FONTS.some((font) => font.id === merged.font)) {
    merged.font = base.font
  }
  if (merged.align !== 'left' && merged.align !== 'center') merged.align = base.align
  if (merged.sizeBy !== 'settings' && merged.sizeBy !== 'height') merged.sizeBy = base.sizeBy
  return merged
}

async function start(): Promise<void> {
  const saved = await loadDoc()
  // A first run shows a complete table, so it is clear what each setting does.
  await load(saved ? restore(saved) : { ...defaultDoc(), logo: await sampleLogo() })
}

void start()
