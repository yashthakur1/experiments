/* Generic immutable tree helpers shared by both canvases. */

interface TreeShape {
  id: string
  children?: TreeShape[]
}

export function insertChild<T extends TreeShape>(root: T, parentId: string, child: T): T {
  if (root.id === parentId) return { ...root, children: [...(root.children ?? []), child] }
  if (!root.children) return root
  return { ...root, children: root.children.map((c) => insertChild(c as T, parentId, child)) }
}

export function patchNode<T extends TreeShape>(root: T, id: string, patch: Partial<T>): T {
  if (root.id === id) return { ...root, ...patch }
  if (!root.children) return root
  return { ...root, children: root.children.map((c) => patchNode(c as T, id, patch)) }
}

export function findById<T extends TreeShape>(node: T, id: string): T | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const hit = findById(child as T, id)
    if (hit) return hit
  }
  return null
}

export function countTree(node: TreeShape): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countTree(c), 0)
}

/** Deepest last descendant — where a streaming writer is currently working. */
export function lastNodeId(node: TreeShape): string {
  let cursor: TreeShape = node
  while (cursor.children && cursor.children.length > 0) cursor = cursor.children[cursor.children.length - 1]
  return cursor.id
}

interface DiffShape extends TreeShape {
  label?: string
  classes?: string
  content?: string
  component?: string
  props?: unknown
  children?: DiffShape[]
}

/** What a change did, by node id: how many nodes are new, gone or edited. */
export function diffTrees(before: DiffShape | null, after: DiffShape | null): { added: number; removed: number; edited: number } {
  const index = (root: DiffShape | null) => {
    const map = new Map<string, string>()
    const walk = (n: DiffShape) => {
      map.set(n.id, JSON.stringify([n.label, n.classes, n.content, n.component, n.props, (n.children ?? []).map((c) => c.id)]))
      n.children?.forEach(walk)
    }
    if (root) walk(root)
    return map
  }
  const a = index(before)
  const b = index(after)
  let added = 0
  let edited = 0
  for (const [id, sig] of b) {
    if (!a.has(id)) added++
    else if (a.get(id) !== sig) edited++
  }
  const removed = [...a.keys()].filter((id) => !b.has(id)).length
  return { added, removed, edited }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
