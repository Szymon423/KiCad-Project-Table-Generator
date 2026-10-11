import type { Doc } from './model'

// IndexedDB rather than localStorage, because the document holds the logo and possibly a font
// as raw bytes, which localStorage could only take as oversized strings.
const DATABASE = 'kicad-table-generator'
const STORE = 'state'
const KEY = 'doc'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const request = action(database.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

/** The document from the last session, or null on a first run or when storage is unavailable. */
export async function loadDoc(): Promise<Partial<Doc> | null> {
  try {
    return (await run<Partial<Doc> | undefined>('readonly', (store) => store.get(KEY))) ?? null
  } catch {
    return null
  }
}

export async function saveDoc(doc: Doc): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(doc, KEY))
  } catch {
    // Private windows and blocked site data land here; the app works without remembering.
  }
}
