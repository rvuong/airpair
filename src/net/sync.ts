import { RoomClient } from './ws'

const ITERATION_INTERVAL_MS = 60
const ITERATION_TIMEOUT_MS = 2000

/**
 * Measures the offset between the local clock and the server clock.
 * Sends `iterations` consecutive server_ping messages (60 ms apart)
 * and returns the median of the computed offsets.
 *
 * Formula per iteration: offset = t2 - (t1 + t4) / 2
 *   t1 = local timestamp at send time
 *   t2 = server timestamp (from pong)
 *   t4 = local timestamp at pong receipt
 */
export async function measureServerOffset(
  client: RoomClient,
  iterations = 5
): Promise<number> {
  const offsets: number[] = []

  for (let i = 0; i < iterations; i++) {
    if (i > 0) {
      await delay(ITERATION_INTERVAL_MS)
    }

    const t1 = Date.now()
    client.serverPing(t1)

    const result = await Promise.race([
      waitForPong(client),
      timeout(ITERATION_TIMEOUT_MS),
    ])

    if (result === null) {
      // Timeout — skip this iteration
      continue
    }

    const { t2, t4 } = result
    const offset = t2 - (t1 + t4) / 2
    offsets.push(offset)
  }

  client.onServerPong = null

  if (offsets.length === 0) {
    return 0
  }

  return median(offsets)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitForPong(client: RoomClient): Promise<{ t2: number; t4: number }> {
  return new Promise((resolve) => {
    client.onServerPong = (_t1: number, t2: number) => {
      const t4 = Date.now()
      resolve({ t2, t4 })
    }
  })
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
  }
  return sorted[mid] as number
}
