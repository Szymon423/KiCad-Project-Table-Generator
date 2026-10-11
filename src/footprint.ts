/**
 * The table as a KiCad footprint: what the Image Converter makes from the PNG, without the trip
 * through it. The rendered table is traced into polygons along its pixel edges, so the
 * footprint shows exactly what the PNG shows, logo and inverted look included.
 */

interface Point {
  x: number
  y: number
}

/** A vertex in a ring that can be spliced, which joining holes to their outline needs. */
interface Node extends Point {
  prev: Node
  next: Node
}

/**
 * How far, in pixels, a simplified outline may stray from the traced one. It has to exceed the
 * 0.7 px depth of a pixel staircase, or slanted edges keep every single step.
 */
const TOLERANCE = 1

const RIGHT = 1
const DOWN = 2
const LEFT = 4
const UP = 8
const STEP: Record<number, Point> = {
  [RIGHT]: { x: 1, y: 0 },
  [DOWN]: { x: 0, y: 1 },
  [LEFT]: { x: -1, y: 0 },
  [UP]: { x: 0, y: -1 },
}
/** The direction after a quarter turn towards the ink, which lies on the right of every edge. */
const TURN_RIGHT: Record<number, number> = { [RIGHT]: DOWN, [DOWN]: LEFT, [LEFT]: UP, [UP]: RIGHT }
const TURN_LEFT: Record<number, number> = { [RIGHT]: UP, [UP]: LEFT, [LEFT]: DOWN, [DOWN]: RIGHT }

/**
 * Follow the border between dark and light pixels and return it as closed loops of corner
 * points. Outlines of ink come out with positive area and holes in it with negative area.
 */
function traceLoops({ data, width, height }: ImageData): Point[][] {
  const ink = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4] < 128

  // Every pixel corner remembers which border edges leave it.
  const stride = width + 1
  const edges = new Uint8Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink(x, y)) continue
      if (!ink(x, y - 1)) edges[y * stride + x] |= RIGHT
      if (!ink(x + 1, y)) edges[y * stride + x + 1] |= DOWN
      if (!ink(x, y + 1)) edges[(y + 1) * stride + x + 1] |= LEFT
      if (!ink(x - 1, y)) edges[(y + 1) * stride + x] |= UP
    }
  }

  const loops: Point[][] = []
  for (let start = 0; start < edges.length; start++) {
    while (edges[start]) {
      const first = [RIGHT, DOWN, LEFT, UP].find((direction) => edges[start] & direction)!
      const loop: Point[] = []
      let at = start
      let direction = first
      let previous = 0
      for (;;) {
        // Only corners are kept; points along a straight run add nothing.
        if (direction !== previous) loop.push({ x: at % stride, y: Math.floor(at / stride) })
        edges[at] &= ~direction
        at += STEP[direction].x + STEP[direction].y * stride
        previous = direction
        // Where two ink pixels touch only by a corner, turning towards the ink keeps them as
        // two separate shapes instead of one that pinches to nothing.
        const next = [TURN_RIGHT[direction], direction, TURN_LEFT[direction]]
        if (at === start && (next[0] === first || !edges[at])) break
        direction = next.find((candidate) => edges[at] & candidate)!
      }
      // The walk may end mid-run; the first point is then not a corner.
      if (previous === first) loop.shift()
      loops.push(loop)
    }
  }
  return loops
}

/** Twice the area of a loop; positive for outlines of ink, negative for holes. */
function signedArea(loop: Point[]): number {
  let sum = 0
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    sum += (loop[j].x - loop[i].x) * (loop[i].y + loop[j].y)
  }
  return sum
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Douglas-Peucker on an open run of points; keeps both ends. */
function simplifyRun(points: Point[], from: number, to: number, keep: boolean[]): void {
  const stack = [[from, to]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let worst = 0
    let index = -1
    for (let i = a + 1; i < b; i++) {
      const distance = distanceToSegment(points[i], points[a], points[b])
      if (distance > worst) {
        worst = distance
        index = i
      }
    }
    if (worst > TOLERANCE) {
      keep[index] = true
      stack.push([a, index], [index, b])
    }
  }
}

/** Replace the pixel staircases of slanted and curved edges with straight segments. */
function simplify(loop: Point[]): Point[] {
  if (loop.length <= 4) return loop
  // A closed loop has no ends, so it is cut in two at its first point and the one farthest away.
  let far = 0
  let farthest = -1
  loop.forEach((point, index) => {
    const distance = Math.hypot(point.x - loop[0].x, point.y - loop[0].y)
    if (distance > farthest) {
      farthest = distance
      far = index
    }
  })
  const closed = [...loop, loop[0]]
  const keep: boolean[] = []
  keep[0] = keep[far] = true
  simplifyRun(closed, 0, far, keep)
  simplifyRun(closed, far, closed.length - 1, keep)
  const result = loop.filter((_, index) => keep[index])
  return result.length >= 3 ? result : loop
}

function contains(loop: Point[], p: Point): boolean {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]
    const b = loop[j]
    if (a.y > p.y !== b.y > p.y && p.x < a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)) inside = !inside
  }
  return inside
}

// --- joining holes to their outline ---
// KiCad's filled polygons cannot have holes, so each hole is connected to its outline by a cut
// of no width, which leaves one continuous boundary. This is the hole-bridging step of the
// earcut triangulation library (ISC license, Mapbox), reduced to what is needed here.

function ring(points: Point[]): Node {
  let last: Node | null = null
  for (const { x, y } of points) {
    const node = { x, y } as Node
    if (last) {
      node.next = last.next
      node.prev = last
      last.next.prev = node
      last.next = node
    } else {
      node.prev = node.next = node
    }
    last = node
  }
  return last!.next
}

const cross = (p: Point, q: Point, r: Point) => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)

function inTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, p: Point): boolean {
  return (
    (cx - p.x) * (ay - p.y) >= (ax - p.x) * (cy - p.y) &&
    (ax - p.x) * (by - p.y) >= (bx - p.x) * (ay - p.y) &&
    (bx - p.x) * (cy - p.y) >= (cx - p.x) * (by - p.y)
  )
}

const locallyInside = (a: Node, b: Point) =>
  cross(a.prev, a, a.next) < 0
    ? cross(a, b, a.next) >= 0 && cross(a, a.prev, b) >= 0
    : cross(a, b, a.prev) < 0 || cross(a, a.next, b) < 0

const sectorContainsSector = (m: Node, p: Node) => cross(m.prev, m, p.prev) < 0 && cross(p.next, m, m.next) < 0

/** Find the outline vertex that the hole's leftmost point can be joined to without crossing anything. */
function findBridge(hole: Node, outline: Node): Node | null {
  const hx = hole.x
  const hy = hole.y
  let qx = -Infinity
  let m: Node | null = null
  let p = outline
  if (p.x === hx && p.y === hy) return p
  do {
    if (p.next.x === hx && p.next.y === hy) return p.next
    if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
      const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y)
      if (x <= hx && x > qx) {
        qx = x
        m = p.x < p.next.x ? p : p.next
        if (x === hx) return m
      }
    }
    p = p.next
  } while (p !== outline)
  if (!m) return null

  const stop = m
  const mx = m.x
  const my = m.y
  let tanMin = Infinity
  p = m
  do {
    if (hx >= p.x && p.x >= mx && hx !== p.x && inTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p)) {
      const tan = Math.abs(hy - p.y) / (hx - p.x)
      if (
        locallyInside(p, hole) &&
        (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))
      ) {
        m = p
        tanMin = tan
      }
    }
    p = p.next
  } while (p !== stop)
  return m
}

/** Cut from `a` on the outline to `b` on the hole and back, making the two rings one. */
function splice(a: Node, b: Node): void {
  const a2 = { x: a.x, y: a.y } as Node
  const b2 = { x: b.x, y: b.y } as Node
  const an = a.next
  const bp = b.prev
  a.next = b
  b.prev = a
  a2.next = an
  an.prev = a2
  b2.next = a2
  a2.prev = b2
  bp.next = b2
  b2.prev = bp
}

function leftmost(start: Node): Node {
  let best = start
  for (let p = start.next; p !== start; p = p.next) {
    if (p.x < best.x || (p.x === best.x && p.y < best.y)) best = p
  }
  return best
}

/** One boundary that runs around the outline and, through cuts, around each of its holes. */
function withHoles(outline: Point[], holes: Point[][]): Point[] {
  const outer = ring(outline)
  const starts = holes.map((hole) => leftmost(ring(hole))).sort((a, b) => a.x - b.x || a.y - b.y)
  for (const hole of starts) {
    const bridge = findBridge(hole, outer)
    if (bridge) splice(bridge, hole)
  }
  const points: Point[] = []
  let p = outer
  do {
    points.push({ x: p.x, y: p.y })
    p = p.next
  } while (p !== outer)
  return points
}

/** Trace a rendered table into filled polygons without holes, in pixels. */
export function tracePolygons(image: ImageData): Point[][] {
  const loops = traceLoops(image).map((loop) => ({ loop, area: signedArea(loop) }))
  const outlines = loops
    .filter(({ area }) => area > 0)
    .map(({ loop, area }) => {
      const xs = loop.map((point) => point.x)
      const ys = loop.map((point) => point.y)
      return {
        loop,
        area,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        holes: [] as Point[][],
      }
    })

  for (const { loop, area } of loops) {
    if (area > 0) continue
    // The centre of a pixel next to the hole's first corner lies inside the shape the hole is in.
    const probe = { x: loop[0].x + 0.5, y: loop[0].y + 0.5 }
    let parent: (typeof outlines)[number] | null = null
    for (const outline of outlines) {
      const [left, top, right, bottom] = outline.box
      if (probe.x < left || probe.x > right || probe.y < top || probe.y > bottom) continue
      // Shapes nest (a letter inside a frame), and the hole belongs to the innermost one.
      if ((!parent || outline.area < parent.area) && contains(outline.loop, probe)) parent = outline
    }
    parent?.holes.push(simplify(loop))
  }

  return outlines.map(({ loop, holes }) => withHoles(simplify(loop), holes))
}

/**
 * The footprint text for a traced table, centred on its origin, on the front silkscreen. Flipping
 * the footprint in KiCad moves it to the back and mirrors it. This text can be saved as a
 * `.kicad_mod` file or pasted straight into the PCB editor.
 */
export function footprintText(image: ImageData, pxPerMm: number, name: string): string {
  const mm = (px: number, size: number) => ((px - size / 2) / pxPerMm).toFixed(6)
  const uuid = () => crypto.randomUUID()
  const hiddenText = (kind: string, text: string) =>
    `  (fp_text ${kind} "${text}" (at 0 0) (layer "F.SilkS") hide\n` +
    `      (effects (font (size 1.5 1.5) (thickness 0.3)))\n    (uuid ${uuid()})\n  )`

  const polygons = tracePolygons(image).map((points) => {
    const xy = points.map(({ x, y }) => `      (xy ${mm(x, image.width)} ${mm(y, image.height)})`).join('\n')
    return (
      `  (fp_poly\n    (pts\n${xy}\n    )\n` +
      `    (stroke (width 0.000000) (type solid)) (fill solid) (layer "F.SilkS") (uuid ${uuid()}))`
    )
  })

  return [
    `(footprint "${name.replace(/["\\]/g, '')}" (version 20221018) (generator "kicad-project-table-generator")`,
    '  (layer "F.Cu")',
    '  (attr board_only exclude_from_pos_files exclude_from_bom)',
    hiddenText('reference', 'G***'),
    hiddenText('value', 'TABLE'),
    ...polygons,
    ')',
    '',
  ].join('\n')
}
