const ICON = (path: string) =>
  `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`

const UP = ICON('M5 12l5-5 5 5')
const DOWN = ICON('M5 8l5 5 5-5')
const REMOVE = ICON('M5 5l10 10M15 5L5 15')

/**
 * The editable list of rows. It owns no state: it draws what `get` returns and hands every
 * change to `set`. Typing does not rebuild the list, so the caret stays where it is.
 */
export function rowList(container: HTMLElement, get: () => string[], set: (rows: string[]) => void) {
  function draw(focus?: number): void {
    const rows = get()
    container.replaceChildren(...rows.map((text, index) => row(text, index, rows.length)))
    if (focus !== undefined) {
      container.querySelectorAll('input')[Math.max(0, Math.min(focus, rows.length - 1))]?.focus()
    }
  }

  /** Apply a change to the list of rows and redraw, keeping the keyboard on row `focus`. */
  function change(edit: (rows: string[]) => void, focus: number): void {
    const rows = [...get()]
    edit(rows)
    set(rows)
    draw(focus)
  }

  const insert = (at: number) => change((rows) => rows.splice(at, 0, ''), at)
  const remove = (at: number, focus = at) => {
    if (get().length > 1) change((rows) => rows.splice(at, 1), focus)
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= get().length) return
    change((rows) => rows.splice(to, 0, ...rows.splice(from, 1)), to)
  }

  function button(icon: string, label: string, action: () => void, disabled = false): HTMLButtonElement {
    const element = document.createElement('button')
    element.innerHTML = icon
    element.title = label
    element.ariaLabel = label
    element.disabled = disabled
    // Row buttons are for the mouse; Tab goes from one text field to the next.
    element.tabIndex = -1
    element.addEventListener('click', action)
    return element
  }

  function row(text: string, index: number, count: number): HTMLElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = text
    input.placeholder = `Row ${index + 1}`
    input.spellcheck = false
    input.addEventListener('input', () => {
      const rows = [...get()]
      rows[index] = input.value
      set(rows)
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        insert(index + 1)
      } else if (event.key === 'Backspace' && input.value === '' && count > 1) {
        event.preventDefault()
        remove(index, index - 1)
      } else if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault()
        move(index, index - 1)
      } else if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault()
        move(index, index + 1)
      }
    })

    const element = document.createElement('div')
    element.className = 'row'
    element.append(
      input,
      button(UP, 'Move up (Alt+Up)', () => move(index, index - 1), index === 0),
      button(DOWN, 'Move down (Alt+Down)', () => move(index, index + 1), index === count - 1),
      button(REMOVE, 'Remove this row', () => remove(index), count === 1),
    )
    return element
  }

  return { draw, add: () => insert(get().length) }
}
