import type { ElementType, ReactNode } from 'react'
import * as Antd from 'antd'
import { fontStack } from '../../language'
import type { DesignFonts } from '../../ai'
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

const A = Antd as unknown as Record<string, ElementType & Record<string, ElementType>>
/** Ant Design's catalog names are its real dotted names (Typography.Title), so each maps to the real sub-component. */
const NAMES = [
  'Button', 'Tag', 'Badge', 'Card', 'Statistic', 'Alert', 'Progress', 'Switch', 'Checkbox', 'Input', 'Select', 'Segmented', 'Divider',
  'Avatar', 'Skeleton', 'Rate', 'Tabs', 'Collapse', 'Table', 'Steps', 'Breadcrumb',
] as const

function Provider({ children, fonts }: { children: ReactNode; fonts?: DesignFonts | null }) {
  return <Antd.ConfigProvider theme={fonts ? { token: { fontFamily: fontStack(fonts.body) } } : undefined}>{children}</Antd.ConfigProvider>
}

const lib: LoadedLibrary = {
  map: {
    ...Object.fromEntries(NAMES.map((n) => [n, A[n]])),
    'Input.TextArea': A.Input?.TextArea,
    'Typography.Title': A.Typography?.Title,
    'Typography.Text': A.Typography?.Text,
    'Typography.Paragraph': A.Typography?.Paragraph,
    Icon,
  },
  Provider,
}
export default lib
