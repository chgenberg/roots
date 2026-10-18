"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * next/image som skärps fram mjukt när bilden laddat. Använd för bilder
 * nedanför vecket — inte för hero-bilder med `priority`.
 */
export function SoftImage({ className, onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      {...props}
      data-loaded={loaded}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn("soft-image", className)}
    />
  );
}
