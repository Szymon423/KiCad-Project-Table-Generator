// Getting files and the clipboard in and out. The desktop app goes through native dialogs and
// the native clipboard; a browser has neither and uses what the page itself can do.

export const isTauri = '__TAURI_INTERNALS__' in window

export interface FileType {
  name: string
  extensions: string[]
}

/**
 * Save a file. The desktop app asks where; a browser downloads it. Returns the name or path
 * it was saved under, or null when the user cancelled.
 */
export async function saveFile(blob: Blob, name: string, type: FileType): Promise<string | null> {
  if (!isTauri) {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = name
    link.click()
    URL.revokeObjectURL(link.href)
    return name
  }
  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ])
  let path = await save({ defaultPath: name, filters: [type] })
  if (!path) return null
  // The dialog lets the name be retyped without its extension.
  const extension = type.extensions[0]
  if (!path.toLowerCase().endsWith(`.${extension}`)) path = `${path}.${extension}`
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
  return path
}

/**
 * Let the user pick one file, or null when they cancel. The desktop app shows its own dialog,
 * because the webview's file picker filters by media type and hides files that have none, such
 * as projects.
 */
export async function pickFile(type: FileType): Promise<File | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = type.extensions.map((extension) => `.${extension}`).join(',')
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
      input.addEventListener('cancel', () => resolve(null))
      input.click()
    })
  }
  const [{ open }, { readFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ])
  const path = await open({ multiple: false, filters: [type] })
  if (!path) return null
  const name = path.split(/[\\/]/).pop() ?? path
  // Bytes read from disk carry no media type, and an image decoder is not obliged to guess one.
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return new File([(await readFile(path)) as BlobPart], name, { type: MEDIA_TYPES[extension] ?? '' })
}

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

/** Put a PNG on the system clipboard. */
export async function copyImage(png: Blob): Promise<void> {
  if (isTauri) {
    // The native clipboard is the reliable route to other desktop apps, above all on Wayland.
    const [{ Image }, { writeImage }] = await Promise.all([
      import('@tauri-apps/api/image'),
      import('@tauri-apps/plugin-clipboard-manager'),
    ])
    await writeImage(await Image.fromBytes(new Uint8Array(await png.arrayBuffer())))
    return
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export async function copyText(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
    return
  }
  await navigator.clipboard.writeText(text)
}
