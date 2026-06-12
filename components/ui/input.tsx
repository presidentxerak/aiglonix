import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-[4px] border border-line bg-base px-3 text-sm text-fg placeholder:text-fg-disabled focus:border-line-active focus:outline-none transition-colors duration-150",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[4px] border border-line bg-base px-3 py-2 text-sm text-fg placeholder:text-fg-disabled focus:border-line-active focus:outline-none transition-colors duration-150",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full min-h-11 rounded-[4px] border border-line bg-base px-3 text-sm text-fg focus:border-line-active focus:outline-none transition-colors duration-150",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs text-fg-muted mb-1.5", className)}
      {...props}
    />
  );
}
