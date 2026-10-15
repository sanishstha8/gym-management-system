import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Dumbbell, Loader2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/data"
import { keys, profileQuery } from "@/data/queries"

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(profileQuery)) throw redirect({ to: "/" })
  },
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const client = useQueryClient()
  const demo = api.mode === "demo"
  const [email, setEmail] = useState(demo ? "owner@shrawngym.demo" : "")
  const [password, setPassword] = useState(demo ? "demo" : "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const profile = await api.signIn(email, password)
      client.setQueryData(keys.profile, profile)
      await navigate({ to: search.redirect ?? "/" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-4" />
          </div>
          Shrawn Gym
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Staff sign in</CardTitle>
            <CardDescription>
              {demo
                ? "Demo mode: use owner@shrawngym.demo or staff@shrawngym.demo with any password."
                : "Sign in with your gym staff account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Sign in
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
