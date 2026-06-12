import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Serve "/" from the app itself instead of a next.config redirect: on this
// Vercel project, config-level redirects for "/" are not honored, leaving the
// root at 404. A real route is always resolved. Locale negotiation stays in
// the (working) localized pages; the root just lands on the default locale.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
