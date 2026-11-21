"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A stable colour per name, so the same person always gets the same fallback. */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/**
 * The contact's picture when we have one, else a coloured initial. Instagram often sends no
 * picture and its image links expire, so a broken image falls back to the initial too.
 */
export function ContactAvatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src: string | null | undefined;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = name?.trim() || "?";

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  const hue = hueFor(label);
  return (
    <div
      className={cn("flex items-center justify-center rounded-full font-medium", className)}
      style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 60% 28%)` }}
    >
      {label[0].toUpperCase()}
    </div>
  );
}
