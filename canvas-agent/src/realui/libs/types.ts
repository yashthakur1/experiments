import type { ComponentType, ElementType, ReactNode } from 'react'

/** One real component library, loaded on demand (each lives in its own chunk). */
export interface LoadedLibrary {
  /** catalog name → the real component */
  map: Record<string, ElementType>
  /** Theme provider the library needs (Material's ThemeProvider, Ant Design's ConfigProvider). */
  Provider?: ComponentType<{ children: ReactNode }>
}
