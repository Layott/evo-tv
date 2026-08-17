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
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around py-3 border-t"
      style={{
        backgroundColor: "#000000",
        borderColor: "rgba(44, 215, 227, 0.2)",
      }}
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id
        const Icon = item.icon

        return (
          <button
            key={item.id}
            onClick={() => handleNavigation(item)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all"
            style={{
              color: isActive ? "#2CD7E3" : "#666666",
            }}
          >
            <Icon size={24} />
            <span className="text-xs font-semibold">{item.label}</span>
            {isActive && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: "#2CD7E3" }} />}
          </button>
        )
      })}
    </div>
  )
}
