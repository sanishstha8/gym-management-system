import { Fingerprint } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Simulated fingerprint sensor: press and hold to "scan". Stands in for a real
 * USB/SDK reader, which would return a template or device user id instead.
 */
export function FingerprintPad({
  onScan,
  holdMs = 900,
  disabled,
  label = "Press and hold",
}: {
  onScan: () => void
  holdMs?: number
  disabled?: boolean
  label?: string
}) {
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)
  const started = useRef(0)

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = null
    setProgress(0)
  }

  const start = () => {
    if (disabled) return
    started.current = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - started.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        frame.current = null
        setProgress(0)
        onScan()
      } else {
        frame.current = requestAnimationFrame(step)
      }
    }
    frame.current = requestAnimationFrame(step)
  }

  useEffect(() => stop, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat && !frame.current) start()
      }}
      onKeyUp={stop}
      className={cn(
        "relative flex size-36 touch-none flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary/40 bg-accent/40 text-primary transition-colors select-none",
        "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
        progress > 0 && "border-solid",
      )}
      aria-label={`${label} to scan fingerprint`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${progress * 301.6} 301.6`}
        />
      </svg>
      <Fingerprint className="size-14" strokeWidth={1.4} />
      <span className="text-xs font-medium">{progress > 0 ? "Scanning…" : label}</span>
    </button>
  )
}
