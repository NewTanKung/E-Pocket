import React from "react";
import Image from "next/image";

export function EPocketSquareMark({
  size = 42,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/epocket-logo-square.svg"
      alt="E-Pocket Logo"
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}

export function EPocketHorizontalLogo({
  width = 210,
  height = 56,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/epocket-logo-horizontal.svg"
      alt="E-Pocket — Monolith Finance"
      width={width}
      height={height}
      className={className}
      unoptimized
    />
  );
}
