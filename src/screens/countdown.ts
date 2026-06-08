/**
 * Renders a synchronised countdown into `container`.
 *
 * @param container    - Host element; its contents are replaced.
 * @param tStartServer - Server-clock timestamp of the "GO" moment.
 * @param serverOffset - Offset (ms) such that localNow = serverNow - serverOffset.
 * @param onDone       - Called ~800 ms after "GO !" is displayed.
 * @returns destroy    - Cancels the rAF loop and empties the container.
 */
import { playCountdownTick, playCountdownGo } from '../game/audio'

export function renderCountdown(
  container: HTMLElement,
  tStartServer: number,
  serverOffset: number,
  onDone: () => void
): () => void {
  // Convert server timestamp to local clock
  const tStartLocal = tStartServer - serverOffset

  // Build the countdown UI
  container.innerHTML = `
    <div class="screen screen-countdown">
      <div class="countdown-number" id="countdown-display">3</div>
    </div>
  `

  const displayEl = container.querySelector<HTMLElement>('#countdown-display')

  let rafId = 0
  let doneTriggered = false
  let lastDisplayed = -1

  function tick(): void {
    const remaining = tStartLocal - Date.now()

    if (remaining > 0) {
      const digit = Math.ceil(remaining / 1000)
      if (digit !== lastDisplayed && displayEl) {
        lastDisplayed = digit
        displayEl.classList.remove('go', 'pulse')
        // Force reflow so the animation restarts
        void displayEl.offsetWidth
        displayEl.textContent = String(digit)
        displayEl.classList.add('pulse')
        playCountdownTick()
      }
      rafId = requestAnimationFrame(tick)
    } else {
      // Show GO!
      if (displayEl && lastDisplayed !== 0) {
        lastDisplayed = 0
        displayEl.classList.remove('pulse')
        void displayEl.offsetWidth
        displayEl.textContent = 'GO !'
        displayEl.classList.add('go', 'pulse')
        playCountdownGo()
      }

      if (!doneTriggered) {
        doneTriggered = true
        setTimeout(onDone, 800)
      }
    }
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(rafId)
    container.innerHTML = ''
  }
}
