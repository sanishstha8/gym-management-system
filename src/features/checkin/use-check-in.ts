import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "@/data"
import { invalidateTopics } from "@/data/queries"
import type { CheckInMethod } from "@/lib/types"

/** Runs a check-in and refreshes attendance-dependent views. */
export function useCheckIn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ method, value }: { method: Exclude<CheckInMethod, "gate">; value: string }) =>
      api.checkIn(method, value),
    onSuccess: () => invalidateTopics(client, "attendance"),
  })
}
