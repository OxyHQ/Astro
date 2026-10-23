import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell, ShellSkeleton } from "@/components/app-shell";
import { getViewer } from "@/lib/api";
import { parseRange, type RangeKey } from "@/lib/range";
import { safeNext } from "@/lib/safe-next";
import { cachedViewer, rememberViewer } from "@/lib/viewer-cache";

export const Route = createFileRoute("/_app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { range?: RangeKey } =>
    search.range === undefined || parseRange(search.range) === "7d" ? {} : { range: parseRange(search.range) },
  beforeLoad: async ({ location }) => {
    const cached = cachedViewer();
    if (cached) return { email: cached };
    const viewer = await getViewer();
    if (viewer.state === "signed-out") throw redirect({ to: "/sign-in", search: { next: safeNext(location.href) } });
    if (viewer.state === "denied") throw redirect({ to: "/not-allowed" });
    rememberViewer(viewer.email);
    return { email: viewer.email };
  },
  pendingComponent: ShellSkeleton,
  pendingMs: 0,
  component: AppLayout,
});

function AppLayout() {
  const { email } = Route.useRouteContext();
  return (
    <AppShell email={email}>
      <Outlet />
    </AppShell>
  );
}
