import * as React from "react";
import {
  Tv,
  Smartphone,
  AppleIcon as AppleLucide,
  Monitor,
  Laptop,
  Terminal,
} from "lucide-react";
import type { AppKind } from "@/lib/mock/apps";

interface IconProps {
  className?: string;
}

export function PlatformIcon({
  kind,
  className,
}: IconProps & { kind: AppKind }): React.ReactElement {
  switch (kind) {
    case "tv":
      return <Tv className={className} />;
    case "android":
      return <Smartphone className={className} />;
    case "ios":
      // Lucide doesn't ship a great Apple icon; render glyph via SVG for parity.
      return <AppleGlyph className={className} />;
    case "windows":
      return <Monitor className={className} />;
    case "macos":
      return <Laptop className={className} />;
    case "linux":
      return <Terminal className={className} />;
  }
}

function AppleGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.468 2.227-1.236 3.02-.823.852-2.175 1.512-3.25 1.427-.137-1.104.413-2.246 1.146-2.984.823-.83 2.23-1.437 3.34-1.463zM20.5 17.403c-.578 1.336-.855 1.932-1.6 3.114-1.04 1.648-2.505 3.7-4.32 3.717-1.613.015-2.028-1.05-4.217-1.037-2.19.012-2.646 1.053-4.26 1.037-1.815-.018-3.204-1.87-4.243-3.517C-.96 16.062-1.27 10.665 1.187 7.74c1.75-2.09 4.516-3.31 7.115-3.31 2.65 0 4.318 1.454 6.512 1.454 2.13 0 3.426-1.456 6.49-1.456 2.316 0 4.77 1.266 6.513 3.452-5.717 3.13-4.795 11.29-1.317 9.524z" />
    </svg>
  );
}
