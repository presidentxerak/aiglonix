// Root layout: required so a real route can exist at "/" (app/page.tsx).
// It is intentionally a pass-through — the per-locale layout in
// app/[locale]/layout.tsx renders <html>/<body>. The root "/" path only
// ever redirects (see app/page.tsx), so no markup is rendered through here.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
