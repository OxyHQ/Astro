import { motion } from "motion/react";
import { Children, Fragment, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const glassPanel =
  "rounded-[14px] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.62))] shadow-[0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] dark:shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]";

export function GlassForm({ children, onSubmit, className }: { children: ReactNode; onSubmit?: (e: FormEvent<HTMLFormElement>) => void; className?: string }) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
      }}
      className={cn("flex w-full max-w-[380px] flex-col gap-5", className)}
    >
      {children}
    </motion.form>
  );
}

export function FormGroup({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div>
      {title ? <div className="px-4 pb-1.5 text-xs font-medium tracking-[0.04em] text-foreground/45 uppercase">{title}</div> : null}
      <div className={cn("overflow-hidden", glassPanel)}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <div className="ml-4 h-px bg-black/[0.06] dark:bg-white/[0.07]" /> : null}
            {child}
          </Fragment>
        ))}
      </div>
      {footer ? <div className="px-4 pt-1.5 text-xs leading-snug text-foreground/45">{footer}</div> : null}
    </div>
  );
}

export function FormField({
  label,
  type = "text",
  name,
  autoComplete,
  placeholder,
  value,
  onChange,
  autoFocus,
  required,
}: {
  label: string;
  type?: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const id = `gf-${name ?? label}`;
  return (
    <div className="flex min-h-12 items-center px-4 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.02]">
      <label htmlFor={id} className="min-w-24 shrink-0 text-[15px] text-foreground/90">
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required={required}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-3 text-right text-[15px] text-foreground outline-none placeholder:text-foreground/30"
      />
    </div>
  );
}

export function FormButton({ children, disabled, busy }: { children: ReactNode; disabled?: boolean; busy?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.button
      type="submit"
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        "w-full rounded-[14px] bg-primary py-3 text-[15px] font-semibold tracking-[-0.01em] text-primary-foreground transition-[filter,opacity] disabled:opacity-50",
        hover && !disabled && "brightness-110",
      )}
    >
      {children}
    </motion.button>
  );
}
