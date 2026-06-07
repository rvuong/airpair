export interface TiltParams {
  deadzone: number;
  amplitude: number;
  exponent: number;
  alpha: number;
}

export class TiltController {
  private gamma0: number = 0;
  private lastGamma: number = 0;
  private smoothed: number = 0;
  private rawCmd: number = 0;
  params: TiltParams;

  private touchStartX: number | null = null;
  private touchCmd: number = 0;
  private usingTouch: boolean = false;

  constructor(params: TiltParams) {
    this.params = { ...params };
  }

  calibrate(currentGamma: number): void {
    this.gamma0 = currentGamma;
    this.lastGamma = currentGamma;
    this.smoothed = 0;
    this.rawCmd = 0;
  }

  onDeviceOrientation(gamma: number): void {
    this.lastGamma = gamma;
    const delta = gamma - this.gamma0;
    const { deadzone, amplitude, exponent } = this.params;

    const absDelta = Math.abs(delta);
    if (absDelta <= deadzone) {
      this.rawCmd = 0;
    } else {
      const normalized = (absDelta - deadzone) / (amplitude - deadzone);
      const clamped = Math.min(normalized, 1);
      this.rawCmd = Math.sign(delta) * Math.pow(clamped, exponent);
    }

    this.usingTouch = false;
  }

  onTouchStart(clientX: number): void {
    this.touchStartX = clientX;
  }

  onTouchMove(clientX: number, screenWidth: number): void {
    if (this.touchStartX === null) return;
    const delta = clientX - this.touchStartX;
    this.touchCmd = Math.max(-1, Math.min(1, delta / (screenWidth * 0.4)));
    this.usingTouch = true;
  }

  onTouchEnd(): void {
    this.touchStartX = null;
    this.touchCmd = 0;
    this.usingTouch = false;
  }

  update(): number {
    const raw = this.usingTouch ? this.touchCmd : this.rawCmd;
    const { alpha } = this.params;
    this.smoothed = alpha * raw + (1 - alpha) * this.smoothed;
    return this.smoothed;
  }

  getCurrentGamma(): number {
    return this.lastGamma;
  }
}
