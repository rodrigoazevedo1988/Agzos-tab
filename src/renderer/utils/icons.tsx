import {
  Activity,
  AppWindow,
  Calculator,
  Clock,
  ClipboardCopy,
  Download,
  FolderOpen,
  FileText,
  Globe,
  Hash,
  History,
  Info,
  Keyboard,
  Link,
  Rocket,
  Settings,
  Star,
  Trash2,
  Upload,
  Circle,
  type LucideIcon,
} from 'lucide-react';

/**
 * Explicit registry so commands can reference icons by name without importing
 * Lucide into every module (which also keeps the icon set tree-shakeable).
 */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  AppWindow,
  Calculator,
  Circle,
  ClipboardCopy,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Hash,
  History,
  Info,
  Keyboard,
  Link,
  Rocket,
  Settings,
  Star,
  Trash2,
  Upload,
};

export function resolveIcon(name: string | undefined): LucideIcon {
  if (name && ICONS[name]) return ICONS[name] as LucideIcon;
  return Circle;
}

export { ICONS };
