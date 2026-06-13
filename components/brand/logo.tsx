import { cn } from "@/lib/utils";

/**
 * AIGLONIX eagle emblem (public/icon-aiglonix.svg). White-on-transparent, so
 * it sits on the dark tactical background. Decorative when paired with the
 * wordmark — the alt text lives on the Brand wrapper.
 */
export function Logo({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-aiglonix.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/** Logo + wordmark, used in the app sidebar and landing header. */
export function Brand({
  className,
  logoSize = 26,
}: {
  className?: string;
  logoSize?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={logoSize} />
      <span className="font-bold tracking-wide">AIGLONIX</span>
    </span>
  );
}
