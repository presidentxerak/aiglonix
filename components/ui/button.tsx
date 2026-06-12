import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[4px] text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-accent text-base hover:bg-accent/85",
        secondary:
          "border border-line bg-surface text-fg hover:border-line-active hover:bg-raised",
        ghost: "text-fg-muted hover:text-fg hover:bg-raised",
        danger: "bg-critical text-fg hover:bg-critical/85",
      },
      size: {
        default: "min-h-11 px-4",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
