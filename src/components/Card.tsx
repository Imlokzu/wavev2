import React from "react";
import { cn } from "@/utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-[#1c2733] border border-[#1f2f3f]",
      outlined: "border-2 border-[#2a3a4a]",
    };

    return (
      <div
        ref={ref}
        className={cn("rounded-2xl p-4", variants[variant], className)}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";
