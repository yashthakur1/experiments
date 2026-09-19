import type { ElementType } from 'react'
import {
  Activity, ArrowRight, Bell, Calendar, Check, ChevronRight, Circle, Clock, Cloud, Code, Cpu, CreditCard, Database, Download, FileText,
  Globe, Heart, Key, Layers, Lock, Mail, Menu, Package, Play, Plus, Rocket, Search, Settings, Shield, Sparkles, Star, Terminal,
  TrendingUp, Upload, User, Users, X, Zap,
} from 'lucide-react'

// Named imports, not `import *`: the bundler keeps only these 37 icons out of lucide's ~1,500.
// Keep in sync with ICON_NAMES in ../catalog.ts (the tests check that every name resolves).
export const ICONS: Record<string, ElementType> = {
  Activity, ArrowRight, Bell, Calendar, Check, ChevronRight, Clock, Cloud, Code, Cpu, CreditCard, Database, Download, FileText,
  Globe, Heart, Key, Layers, Lock, Mail, Menu, Package, Play, Plus, Rocket, Search, Settings, Shield, Sparkles, Star, Terminal,
  TrendingUp, Upload, User, Users, X, Zap,
}

/** lucide icon by name; forwards data-node-id, className and handlers to the <svg>. */
export function Icon({ name, ...rest }: { name?: string } & Record<string, unknown>) {
  const Glyph = ICONS[name ?? ''] ?? Circle
  return <Glyph {...rest} />
}
