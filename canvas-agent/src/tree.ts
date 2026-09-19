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

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
