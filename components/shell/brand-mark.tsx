import Image from "next/image";

interface Props {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

export function BrandMark({ size = 28, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/evo-logo/evo-tv-152.png"
        alt="EVO TV"
        width={size}
        height={size}
        priority
        className="object-contain"
      />
      {withWordmark && (
        <span className="text-sm font-semibold tracking-tight text-foreground">
          EVO TV
        </span>
      )}
    </span>
  );
}
