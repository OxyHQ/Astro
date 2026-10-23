import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function PasswordField({
  label = "Password",
  name = "password",
  autoComplete = "current-password",
  value,
  onChange,
}: {
  label?: string;
  name?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const id = `pf-${name}`;
  return (
    <div className="flex min-h-12 items-center pr-1.5 pl-4 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.02]">
      <label htmlFor={id} className="min-w-24 shrink-0 text-[15px] text-foreground/90">
        {label}
      </label>
      <input
        id={id}
        type={visible ? "text" : "password"}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-3 text-right text-[15px] text-foreground outline-none"
        style={{ letterSpacing: visible || !value ? undefined : "0.12em" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="ml-1.5 grid size-8 shrink-0 place-items-center rounded-lg border border-black/[0.06] bg-black/[0.03] text-foreground/50 transition-colors hover:bg-black/[0.07] hover:text-foreground dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}
