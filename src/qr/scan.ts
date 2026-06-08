import jsQR from 'jsqr'

// BarcodeDetector is not yet in the TypeScript DOM lib (as of ES2020).
// We declare the minimal interface we need.
interface BarcodeDetectorResult {
  rawValue: string
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): {
    detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>
  }
}

declare const BarcodeDetector: BarcodeDetectorConstructor | undefined

/**
 * Starts scanning `video` for a QR code.
 * Calls `onResult` once with the decoded string, then auto-stops.
 * Returns a `stop` function to cancel scanning early.
 *
 * The caller is responsible for setting up the video element
 * (getUserMedia, play(), etc.) before calling this function.
 */
export function startScan(
  video: HTMLVideoElement,
  onResult: (roomId: string) => void
): () => void {
  let stopped = false
  let rafId = 0

  const useBarcodeDetector =
    typeof BarcodeDetector !== 'undefined'

  if (useBarcodeDetector) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] })
    const tick = (): void => {
      if (stopped) return
      detector
        .detect(video)
        .then((results) => {
          if (stopped) return
          if (results.length > 0 && results[0].rawValue) {
            stopped = true
            onResult(results[0].rawValue)
            return
          }
          rafId = requestAnimationFrame(tick)
        })
        .catch(() => {
          if (!stopped) {
            rafId = requestAnimationFrame(tick)
          }
        })
    }
    rafId = requestAnimationFrame(tick)
  } else {
    // jsQR fallback: draw each frame to an offscreen canvas, extract ImageData
    const offscreen = document.createElement('canvas')
    const ctx = offscreen.getContext('2d')

    const tick = (): void => {
      if (stopped) return

      if (
        ctx &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0
      ) {
        offscreen.width = video.videoWidth
        offscreen.height = video.videoHeight
        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height)
        const imageData = ctx.getImageData(
          0,
          0,
          offscreen.width,
          offscreen.height
        )
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code) {
          stopped = true
          onResult(code.data)
          return
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  return () => {
    stopped = true
    cancelAnimationFrame(rafId)
  }
}
