import { LANG_ICONS } from '../../langIcons'

/** lucide icon by name; forwards data-node-id, className and handlers to the <svg>. */
export function Icon({ name, ...rest }: { name?: string } & Record<string, unknown>) {
  const Glyph = LANG_ICONS[name ?? ''] ?? LANG_ICONS.Circle
  return <Glyph {...rest} />
}
