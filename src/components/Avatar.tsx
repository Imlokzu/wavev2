import React from "react";
import { cn } from "@/utils/cn";

interface AvatarProps {
  src?: string | null;
  initials?: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, initials, color = "#2e7d5b", size = "md", className, alt = "Avatar" }, ref) => {
    const sizes = {
      xs: "h-6 w-6 text-[10px]",
      sm: "h-8 w-8 text-xs",
      md: "h-11 w-11 text-sm",
      lg: "h-14 w-14 text-lg",
      xl: "h-24 w-24 text-2xl",
    };

    if (src) {
      return (
        <img
          ref={ref as React.Ref<HTMLImageElement>}
          src={src}
          alt={alt}
          className={cn("rounded-full object-cover", sizes[size], className)}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-full font-bold text-white",
          sizes[size],
          className
        )}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
