import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-[4px] text-sm font-bold transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 cursor-pointer will-change-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-ink shadow-[0_0_0_0_rgba(56,189,248,0)] hover:bg-accent/90 hover:shadow-[0_10px_28px_-8px_rgba(56,189,248,0.55)]",
        secondary:
          "border border-line bg-surface text-fg hover:border-line-active hover:bg-raised hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]",
        ghost: "text-fg-muted hover:text-fg hover:bg-raised",
        danger:
          "bg-critical text-fg hover:bg-critical/90 hover:shadow-[0_10px_28px_-8px_rgba(244,63,94,0.55)]",
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
