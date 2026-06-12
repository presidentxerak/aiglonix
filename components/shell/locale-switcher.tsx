"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="inline-flex border border-line rounded-[4px] overflow-hidden">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          aria-pressed={l === locale}
          className={cn(
            "px-2.5 py-1.5 text-xs uppercase transition-colors duration-150 cursor-pointer min-h-9",
            l === locale
              ? "bg-raised text-accent"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
