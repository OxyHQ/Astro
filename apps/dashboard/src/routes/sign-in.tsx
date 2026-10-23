import { createFileRoute } from "@tanstack/react-router";
import { SignInScreen } from "@/components/sign-in-screen";
import { safeNext } from "@/lib/safe-next";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => (typeof search.next === "string" ? { next: search.next } : {}),
  component: SignInRoute,
});

function SignInRoute() {
  const { next } = Route.useSearch();
  return <SignInScreen next={safeNext(next)} />;
}
