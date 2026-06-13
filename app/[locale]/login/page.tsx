"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://aiglonix.vercel.app";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  callsign: z.string().min(1).max(32).optional(),
});

export default function LoginPage() {
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callsign, setCallsign] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = CredentialsSchema.safeParse({
      email,
      password,
      callsign: mode === "signup" ? callsign || "Operator" : undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(
        issue?.path[0] === "password"
          ? t("errors.shortPassword")
          : t("errors.invalidEmail"),
      );
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const captchaOptions = captchaToken
        ? { captchaToken }
        : undefined;

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            ...captchaOptions,
            data: { callsign: parsed.data.callsign },
          },
        });
        if (error) throw error;
        toast.success(t("checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
          options: captchaOptions,
        });
        if (error) throw error;
        router.push("/operation");
        router.refresh();
      }
    } catch {
      // Generic error on purpose - no internal detail, no user enumeration
      toast.error(t("errors.authFailed"));
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-bold text-2xl tracking-wide">
            {tCommon("appName")}
          </h1>
        </div>

        <div className="card p-5 md:p-6">
          <h2 className="font-bold text-lg mb-5">{t("title")}</h2>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && (
                <p className="mt-1.5 text-xs text-fg-muted">
                  {t("passwordHint")}
                </p>
              )}
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="callsign">{t("callsign")}</Label>
                <Input
                  id="callsign"
                  type="text"
                  maxLength={32}
                  placeholder={t("callsignPlaceholder")}
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                />
              </div>
            )}

            {TURNSTILE_SITE_KEY && (
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setCaptchaToken}
                options={{ theme: "dark", size: "flexible" }}
              />
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {mode === "signup" ? t("signUp") : t("signIn")}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 text-xs text-accent hover:underline cursor-pointer min-h-11"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t("switchToSignUp") : t("switchToSignIn")}
          </button>
        </div>

        {/* Anti-phishing policy (§2.7.3) - naming the official URL is defense #1 */}
        <p className="mt-6 text-xs text-fg-muted leading-relaxed border-l-2 border-line pl-3">
          {t("antiPhishing", { url: APP_URL.replace(/^https?:\/\//, "") })}
        </p>
      </div>
    </div>
  );
}
