import { TiltController } from './tilt.ts';
import { AudioSystem } from './audio.ts';
import { Game } from './game.ts';
import { initTuningPanel } from './tuning.ts';

const startScreen = document.getElementById('start-screen') as HTMLDivElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const errorMsg = document.getElementById('error-msg') as HTMLParagraphElement;
const btnRecalibrate = document.getElementById('btn-recalibrate') as HTMLButtonElement;
const landscapeWarning = document.getElementById('landscape-warning') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const tiltParams = {
  deadzone: 1.5,
  amplitude: 20,
  exponent: 1.4,
  alpha: 0.3,
};

const tilt = new TiltController(tiltParams);

let audioCtx: AudioContext | null = null;
let audioSystem: AudioSystem | null = null;
let game: Game | null = null;
let gamePaused = false;

function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

function checkOrientation(): void {
  if (isLandscape()) {
    landscapeWarning.classList.add('visible');
    if (game && !gamePaused) {
      game.suspend();
      gamePaused = true;
    }
  } else {
    landscapeWarning.classList.remove('visible');
    if (game && gamePaused) {
      game.resume();
      gamePaused = false;
    }
  }
}

window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    tilt.onTouchMove(touch.clientX, window.innerWidth);
  }
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    tilt.onTouchStart(touch.clientX);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  tilt.onTouchEnd();
}, { passive: false });

document.body.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

btnPlay.addEventListener('click', async () => {
  btnPlay.disabled = true;
  errorMsg.style.display = 'none';

  // iOS : requestPermission doit être le premier appel async du handler de geste.
  const DevOrientationEvent = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };

  if (typeof DevOrientationEvent.requestPermission === 'function') {
    let permission: string;
    try {
      permission = await DevOrientationEvent.requestPermission();
    } catch {
      permission = 'denied';
    }
    if (permission !== 'granted') {
      errorMsg.textContent =
        "Permission d'orientation refusée. Autorisez l'accès au capteur dans les réglages Safari.";
      errorMsg.style.display = 'block';
      btnPlay.disabled = false;
      return;
    }
  }

  // AudioContext après la permission capteur — toujours dans le même geste utilisateur.
  audioCtx = new AudioContext();
  audioSystem = new AudioSystem(audioCtx);

  try {
    await audioCtx.resume();
  } catch {
    // ignore
  }
  audioSystem.playSilent();

  window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
    if (e.gamma !== null) {
      tilt.onDeviceOrientation(e.gamma);
    }
  });

  tilt.calibrate(tilt.getCurrentGamma());

  try {
    await navigator.wakeLock.request('screen');
  } catch {
    // not supported or denied — ignore silently
  }

  startScreen.style.display = 'none';
  btnRecalibrate.style.display = 'block';

  initTuningPanel(tiltParams);

  game = new Game(canvas, tilt, audioSystem);
  game.start();

  checkOrientation();
});

btnRecalibrate.addEventListener('click', () => {
  tilt.calibrate(tilt.getCurrentGamma());
});
