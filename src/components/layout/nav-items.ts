import {
  BarChart3, BookOpen, CalendarDays, Headphones, Home, MessageSquareText, Mic, NotebookPen, PenLine, Settings, AudioLines, Sun,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/lesson", label: "Today", icon: Sun },
  { href: "/speaking", label: "Speaking", icon: Mic },
  { href: "/listening", label: "Listening", icon: Headphones },
  { href: "/writing", label: "Writing", icon: PenLine },
  { href: "/roleplay", label: "Roleplay", icon: MessageSquareText },
  { href: "/shadowing", label: "Shadowing", icon: AudioLines },
  { href: "/mistakes", label: "Mistake Hub", icon: NotebookPen },
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { href: "/calendar", label: "30-Day Journey", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: BarChart3 },
] as const;

export const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings };

export const MOBILE_TABS = ["/dashboard", "/lesson", "/speaking", "/mistakes"] as const;
