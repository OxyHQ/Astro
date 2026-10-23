import { useState } from "react";
import CloudBackground from "@/components/ruixen/cloud-background";
import { FormButton, FormField, FormGroup, GlassForm } from "@/components/ruixen/glass-form";
import PasswordField from "@/components/ruixen/password-field";
import ScrambleText from "@/components/ruixen/scramble-text";
import { hexclaveClientApp } from "@/lib/hexclave";
import { safeNext } from "@/lib/safe-next";

export function SignInScreen({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await hexclaveClientApp.signInWithCredential({ email: email.trim(), password, noRedirect: true });
      if (result.status === "error") {
        setError("That email and password don't match.");
        setBusy(false);
        return;
      }
      window.location.replace(safeNext(next));
    } catch {
      setError("Couldn't reach the sign-in service. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-12">
      <CloudBackground />
      <div className="relative flex w-full max-w-[380px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/app-icon.png" alt="" width={56} height={56} className="size-14 rounded-[15px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]" />
          <ScrambleText as="h1" playOnMount className="text-[1.65rem] font-semibold tracking-[-0.025em]">
            Astro dashboard
          </ScrambleText>
          <p className="max-w-72 text-sm text-foreground/60">Private. Sign in with the owner account.</p>
        </div>
        <GlassForm onSubmit={submit}>
          <FormGroup
            footer={
              error ? (
                <span role="alert" className="text-bad">
                  {error}
                </span>
              ) : undefined
            }
          >
            <FormField label="Email" type="email" name="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={setEmail} autoFocus required />
            <PasswordField value={password} onChange={setPassword} />
          </FormGroup>
          <FormButton disabled={busy || !email || !password} busy={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </FormButton>
        </GlassForm>
      </div>
    </main>
  );
}
