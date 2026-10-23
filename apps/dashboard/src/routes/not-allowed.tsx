import { createFileRoute } from "@tanstack/react-router";
import { NotAllowed } from "@/components/not-allowed";

export const Route = createFileRoute("/not-allowed")({ component: NotAllowed });
