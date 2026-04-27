"use client";

import * as React from "react";
import { Heart, MessageSquare, Play, ShoppingBag } from "lucide-react";

interface ActivityItem {
  icon: React.ReactNode;
  label: string;
  when: string;
}

export function ActivityFeed() {
  const items: ActivityItem[] = [
    {
      icon: <Play className="size-4 text-sky-400" />,
      label: "Watched EVO Championship Week 4 Recap",
      when: "2h ago",
    },
    {
      icon: <Heart className="size-4 text-rose-400" />,
      label: "Liked clip: Insane 1v4 clutch by viper",
      when: "Yesterday",
    },
    {
      icon: <MessageSquare className="size-4 text-sky-400" />,
      label: "Joined chat on stream_lagos_final",
      when: "2 days ago",
    },
    {
      icon: <ShoppingBag className="size-4 text-amber-400" />,
      label: "Ordered Team Alpha Jersey",
      when: "5 days ago",
    },
  ];
  return (
    <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/40">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3 p-3">
          <div className="rounded-full bg-neutral-800 p-2">{i.icon}</div>
          <p className="flex-1 text-sm text-neutral-200">{i.label}</p>
          <p className="text-xs text-neutral-500">{i.when}</p>
        </li>
      ))}
    </ul>
  );
}
