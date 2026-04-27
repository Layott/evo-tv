"use client"

import { Search } from "lucide-react"
import Image from "next/image"

export default function TopNavbar() {
  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
      style={{
        backgroundColor: "#000000",
        borderColor: "rgba(44, 215, 227, 0.2)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/evotv%20colored-cLVxaAns95OoPRdSwAHZUktQ6y8MTs.png"
          alt="EVO TV"
          width={32}
          height={32}
          className="w-8 h-8"
        />
        <span className="font-bold text-white text-lg">EVO TV</span>
      </div>

      {/* Search Icon */}
      <button
        className="p-2 rounded-lg transition-all"
        style={{
          color: "#2CD7E3",
        }}
      >
        <Search size={24} />
      </button>
    </div>
  )
}
