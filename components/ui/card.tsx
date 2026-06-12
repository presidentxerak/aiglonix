import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  critical = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { critical?: boolean }) {
  return (
    <div
      className={cn("card p-4 md:p-5", critical && "card-critical", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base md:text-lg font-bold text-fg mb-2", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-sm text-fg-muted", className)} {...props} />
  );
}
