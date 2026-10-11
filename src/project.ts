import type { Doc, StoredFile } from './model'

/** The extension editable projects are saved with. */
export const PROJECT_EXTENSION = 'ktable'

export const isProjectFile = (name: string) => name.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)

const APP = 'kicad-project-table-generator'

/** A stored file with its bytes written as base64, so the project stays plain JSON. */
interface PackedFile {
  name: string
  type: string
  data: string
}

interface ProjectFile {
  app: typeof APP
  version: 1
  doc: Omit<Doc, 'logo' | 'customFont'> & { logo: PackedFile | null; customFont: PackedFile | null }
}

function pack(file: StoredFile | null): PackedFile | null {
  if (!file) return null
  const bytes = new Uint8Array(file.bytes)
  let binary = ''
  // In slices, because spreading a whole font into one call overflows the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return { name: file.name, type: file.type, data: btoa(binary) }
}

function unpack(file: PackedFile | null | undefined): StoredFile | null {
  if (!file || typeof file.data !== 'string') return null
  const bytes = Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0))
  return { name: String(file.name), type: String(file.type), bytes: bytes.buffer }
}

/** The whole document, logo and custom font included, as one self-contained file. */
export function serializeProject(doc: Doc): Blob {
  const project: ProjectFile = {
    app: APP,
    version: 1,
    doc: { ...doc, logo: pack(doc.logo), customFont: pack(doc.customFont) },
  }
  return new Blob([JSON.stringify(project)], { type: 'application/json' })
}

/** Read a project file. The result still has to be checked field by field before use. */
export function parseProject(text: string): Partial<Doc> {
  const project = JSON.parse(text) as Partial<ProjectFile>
  if (project.app !== APP || typeof project.doc !== 'object' || !project.doc) {
    throw new Error('Not a table project')
  }
  return { ...project.doc, logo: unpack(project.doc.logo), customFont: unpack(project.doc.customFont) }
}
