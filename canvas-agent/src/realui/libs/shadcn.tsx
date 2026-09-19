import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

/** shadcn/ui: the official new-york-v4 source, copied into src/components/ui. */
const lib: LoadedLibrary = {
  map: {
    Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Textarea, Label, Separator,
    Avatar, AvatarFallback, Tabs, TabsList, TabsTrigger, TabsContent, Switch, Checkbox, Progress, Alert, AlertTitle,
    AlertDescription, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, Accordion, AccordionItem,
    AccordionTrigger, AccordionContent, Icon,
  },
}
export default lib
