"use client"

import { Home, Calendar, Compass, Library, User, ShoppingBag } from "@/components/icons"
import { useRouter } from "next/navigation"

interface BottomNavigationProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const navItems = [
  { id: "home", label: "Home", icon: Home, route: "/home" },
  { id: "events", label: "Events", icon: Calendar, route: "/events" },
  { id: "discover", label: "Discover", icon: Compass, route: "/discover" },
  { id: "shop", label: "Shop", icon: ShoppingBag, route: "/shop" },
  { id: "library", label: "Library", icon: Library, route: "/library" },
  { id: "profile", label: "Profile", icon: User, route: "/profile" },
]

export default function BottomNavigation({ activeTab, setActiveTab }: BottomNavigationProps) {
  const router = useRouter()

  const handleNavigation = (item: (typeof navItems)[0]) => {
    setActiveTab(item.id)
    router.push(item.route)
  }

  return (
    // Every colour here used to be an inline literal: a pure black ground, a
    // tinted top rule, and a hardcoded cyan. It reads off the theme now, and the
    // bar separates from the page by surface weight rather than by that rule.
    <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around bg-card py-3">
      {navItems.map((item) => {
        const isActive = activeTab === item.id
        const Icon = item.icon

        return (
          <button
            key={item.id}
            onClick={() => handleNavigation(item)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
              isActive ? "text-sky-400" : "text-muted-foreground"
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-semibold">{item.label}</span>
            {isActive && <div className="w-1 h-1 rounded-full bg-sky-400" />}
          </button>
        )
      })}
    </div>
  )
}
