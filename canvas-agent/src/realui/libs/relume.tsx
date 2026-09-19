import type { ElementType } from 'react'
import * as Relume from '@relume_io/relume-ui'
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

const R = Relume as unknown as Record<string, ElementType>
const lib: LoadedLibrary = {
  map: {
    Button: R.Button, Badge: R.Badge, Input: R.Input, Textarea: R.Textarea, Label: R.Label, Checkbox: R.Checkbox, Switch: R.Switch,
    Separator: R.Separator, Skeleton: R.Skeleton, Tabs: R.Tabs, TabsList: R.TabsList, TabsTrigger: R.TabsTrigger,
    TabsContent: R.TabsContent, Accordion: R.Accordion, AccordionItem: R.AccordionItem, AccordionTrigger: R.AccordionTrigger,
    AccordionContent: R.AccordionContent, Table: R.Table, TableHeader: R.TableHeader, TableBody: R.TableBody,
    TableRow: R.TableRow, TableHead: R.TableHead, TableCell: R.TableCell, Icon,
  },
}
export default lib
