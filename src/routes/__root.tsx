import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-heading text-xl font-semibold">Page not found</p>
      <Button asChild variant="outline">
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  ),
})
