import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { CameraOff, Loader2 } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

/** Live camera QR scanner. Calls `onDecode` for each distinct code it reads. */
export function QrScanner({ onDecode, paused }: { onDecode: (text: string) => void; paused?: boolean }) {
  const id = useId().replace(/:/g, "")
  const elementId = `qr-reader-${id}`
  const [state, setState] = useState<"starting" | "running" | "error">("starting")
  const [error, setError] = useState<string | null>(null)
  const callback = useRef(onDecode)
  const pausedRef = useRef(paused)
  const last = useRef<{ text: string; at: number } | null>(null)

  useEffect(() => {
    callback.current = onDecode
    pausedRef.current = paused
  })

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    })
    let cancelled = false
    const started = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (pausedRef.current) return
          // Ignore the same code held in front of the camera.
          const now = Date.now()
          if (last.current && last.current.text === text && now - last.current.at < 4000) return
          last.current = { text, at: now }
          callback.current(text)
        },
        () => {},
      )
      .then(() => !cancelled && setState("running"))
      .catch((e: unknown) => {
        if (cancelled) return
        setState("error")
        setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
      void started.then(async () => {
        if (scanner.isScanning) await scanner.stop()
        scanner.clear()
      })
    }
  }, [elementId])

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black/90">
      <div id={elementId} className="size-full [&_video]:size-full [&_video]:object-cover" />
      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/85">
          <CameraOff className="size-6" />
          <p>Camera unavailable. Allow camera access, or paste the QR text below.</p>
          {error && <p className="text-xs text-white/50">{error}</p>}
        </div>
      )}
    </div>
  )
}
