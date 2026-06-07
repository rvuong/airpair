import type { TiltParams } from './tilt.ts';

export function initTuningPanel(params: TiltParams): void {
  const panel = document.getElementById('tuning-panel') as HTMLDivElement;
  panel.classList.add('visible');

  const slDeadzone = document.getElementById('sl-deadzone') as HTMLInputElement;
  const slAmplitude = document.getElementById('sl-amplitude') as HTMLInputElement;
  const slExponent = document.getElementById('sl-exponent') as HTMLInputElement;
  const slAlpha = document.getElementById('sl-alpha') as HTMLInputElement;

  const valDeadzone = document.getElementById('val-deadzone') as HTMLSpanElement;
  const valAmplitude = document.getElementById('val-amplitude') as HTMLSpanElement;
  const valExponent = document.getElementById('val-exponent') as HTMLSpanElement;
  const valAlpha = document.getElementById('val-alpha') as HTMLSpanElement;

  function syncDisplay(): void {
    valDeadzone.textContent = `${Number(slDeadzone.value).toFixed(1)}°`;
    valAmplitude.textContent = `${Number(slAmplitude.value).toFixed(0)}°`;
    valExponent.textContent = Number(slExponent.value).toFixed(1);
    valAlpha.textContent = Number(slAlpha.value).toFixed(2);
  }

  slDeadzone.addEventListener('input', () => {
    params.deadzone = Number(slDeadzone.value);
    syncDisplay();
  });

  slAmplitude.addEventListener('input', () => {
    params.amplitude = Number(slAmplitude.value);
    syncDisplay();
  });

  slExponent.addEventListener('input', () => {
    params.exponent = Number(slExponent.value);
    syncDisplay();
  });

  slAlpha.addEventListener('input', () => {
    params.alpha = Number(slAlpha.value);
    syncDisplay();
  });

  syncDisplay();
}
