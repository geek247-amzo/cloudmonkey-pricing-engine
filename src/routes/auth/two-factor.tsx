import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/two-factor")({
  component: Outlet,
});
