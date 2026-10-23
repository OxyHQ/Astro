import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

function Screen({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <img src="/astro-mark.png" alt="" width={56} height={42} className="opacity-80" />
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="text-sm break-words text-muted-foreground">{body}</p>
        <div className="mt-2 flex gap-2">{children}</div>
      </div>
    </div>
  );
}

export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Screen title="That didn't load" body={message || "Something went wrong."}>
      <Button
        onClick={() => {
          reset();
          router.invalidate();
        }}
      >
        Try again
      </Button>
      <Button variant="outline" asChild>
        <Link to="/" search={{}}>Overview</Link>
      </Button>
    </Screen>
  );
}

export function NotFoundScreen() {
  return (
    <Screen title="Nothing here" body="That page doesn't exist in the dashboard.">
      <Button asChild>
        <Link to="/" search={{}}>Back to the overview</Link>
      </Button>
    </Screen>
  );
}
