import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SEVERITIES } from "@/lib/schemas";

type Severity = (typeof SEVERITIES)[number];

/** Severity is always color + icon + text label - never color alone. */
const STYLES: Record<Severity, { icon: string; cls: string }> = {
  critical: { icon: "▲", cls: "text-critical border-critical/40" },
  high: { icon: "▲", cls: "text-high border-high/40" },
  medium: { icon: "●", cls: "text-medium border-medium/40" },
  low: { icon: "●", cls: "text-fg-muted border-line" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useTranslations("common.severity");
  const s = STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-xs",
        s.cls,
      )}
    >
      <span aria-hidden>{s.icon}</span>
      {t(severity)}
    </span>
  );
}
