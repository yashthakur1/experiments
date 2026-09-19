import type { ElementType } from 'react'
import * as HeroUI from '@heroui/react'
import './heroui.css' // HeroUI's component stylesheet (~430 KB): only loaded with this chunk
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

const H = HeroUI as unknown as Record<string, ElementType>
/** HeroUI's catalog names ARE its real export names, so the map is a plain lookup. */
const NAMES = [
  'Button', 'Chip', 'Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'Alert', 'AlertIndicator',
  'AlertContent', 'AlertTitle', 'AlertDescription', 'Avatar', 'AvatarFallback', 'ProgressBar', 'ProgressBarTrack', 'ProgressBarFill',
  'Switch', 'SwitchControl', 'SwitchThumb', 'SwitchContent', 'Checkbox', 'CheckboxControl', 'CheckboxIndicator', 'CheckboxContent',
  'Input', 'Label', 'Separator', 'Skeleton', 'Spinner', 'Kbd', 'Link', 'Tabs', 'TabListContainer', 'TabList', 'Tab', 'TabIndicator',
  'TabPanel', 'Accordion', 'AccordionItem', 'AccordionHeading', 'AccordionTrigger', 'AccordionIndicator', 'AccordionPanel',
  'AccordionBody', 'Table', 'TableScrollContainer', 'TableContent', 'TableHeader', 'TableColumn', 'TableBody', 'TableRow', 'TableCell',
] as const

const lib: LoadedLibrary = { map: { ...Object.fromEntries(NAMES.map((n) => [n, H[n]])), Icon } }
export default lib
