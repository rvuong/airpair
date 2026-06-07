import type { TiltController } from './tilt.ts';
import type { AudioSystem } from './audio.ts';

const PADDLE_HEIGHT = 14;
const PADDLE_MARGIN = 40;
const PADDLE_RADIUS = 7;
const BALL_RADIUS = 10;
const INITIAL_SPEED = 400;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Paddle {
  x: number;
  width: number;
}

function randomInitialVelocity(speed: number): { vx: number; vy: number } {
  const angle = (Math.random() * 100 - 50) * (Math.PI / 180);
  return {
    vx: Math.sin(angle) * speed,
    vy: -Math.cos(angle) * speed,
  };
}

function resetBall(cw: number): Ball {
  const vel = randomInitialVelocity(INITIAL_SPEED);
  return {
    x: cw / 2,
    y: cw * 0.3,
    vx: vel.vx,
    vy: vel.vy,
  };
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tilt: TiltController;
  private audio: AudioSystem;

  private ball: Ball;
  private paddle: Paddle;
  private running: boolean = false;
  private rafId: number = 0;
  private lastTime: number = 0;
  private suspended: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    tilt: TiltController,
    audio: AudioSystem
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;

    this.tilt = tilt;
    this.audio = audio;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.suspended = true;
      } else {
        this.suspended = false;
        this.lastTime = 0;
      }
    });

    const cw = window.innerWidth;
    this.ball = resetBall(cw);
    this.paddle = {
      x: cw / 2 - cw * 0.2,
      width: cw * 0.4,
    };
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);

    const cw = window.innerWidth;
    this.ball = resetBall(cw);
    this.paddle = {
      x: cw / 2 - cw * 0.2,
      width: cw * 0.4,
    };
  }

  start(): void {
    this.running = true;
    this.lastTime = 0;
    this.loop(0);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  suspend(): void {
    this.suspended = true;
  }

  resume(): void {
    this.suspended = false;
    this.lastTime = 0;
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    this.rafId = requestAnimationFrame((ts) => this.loop(ts));

    if (this.suspended) return;

    if (this.lastTime === 0) {
      this.lastTime = timestamp;
      return;
    }

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();
  }

  private update(dt: number): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    const cmd = this.tilt.update();
    const paddleSpeed = cw * 1.5;
    this.paddle.x += cmd * paddleSpeed * dt;
    this.paddle.x = Math.max(0, Math.min(cw - this.paddle.width, this.paddle.x));

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x - BALL_RADIUS < 0) {
      this.ball.x = BALL_RADIUS;
      this.ball.vx = Math.abs(this.ball.vx);
    }
    if (this.ball.x + BALL_RADIUS > cw) {
      this.ball.x = cw - BALL_RADIUS;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y - BALL_RADIUS < 0) {
      this.ball.y = BALL_RADIUS;
      this.ball.vy = Math.abs(this.ball.vy);
    }

    const paddleTop = ch - PADDLE_MARGIN - PADDLE_HEIGHT;
    const paddleBottom = paddleTop + PADDLE_HEIGHT;
    const paddleLeft = this.paddle.x;
    const paddleRight = this.paddle.x + this.paddle.width;

    if (
      this.ball.vy > 0 &&
      this.ball.y + BALL_RADIUS >= paddleTop &&
      this.ball.y + BALL_RADIUS <= paddleBottom + 10 &&
      this.ball.x >= paddleLeft - BALL_RADIUS &&
      this.ball.x <= paddleRight + BALL_RADIUS
    ) {
      const hitPos = (this.ball.x - paddleLeft) / this.paddle.width;
      const normalizedHit = hitPos * 2 - 1;
      const bounceAngle = normalizedHit * 65 * (Math.PI / 180);

      const speed = Math.sqrt(
        this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy
      );
      this.ball.vx = Math.sin(bounceAngle) * speed;
      this.ball.vy = -Math.abs(Math.cos(bounceAngle) * speed);
      this.ball.y = paddleTop - BALL_RADIUS;

      this.audio.playPock();
    }

    if (this.ball.y - BALL_RADIUS > ch) {
      this.ball = resetBall(cw);
    }
  }

  private draw(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    this.ctx.clearRect(0, 0, cw, ch);

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, cw, ch);

    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();

    const paddleTop = ch - PADDLE_MARGIN - PADDLE_HEIGHT;
    const r = PADDLE_RADIUS;
    const px = this.paddle.x;
    const pw = this.paddle.width;

    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.moveTo(px + r, paddleTop);
    this.ctx.lineTo(px + pw - r, paddleTop);
    this.ctx.quadraticCurveTo(px + pw, paddleTop, px + pw, paddleTop + r);
    this.ctx.lineTo(px + pw, paddleTop + PADDLE_HEIGHT - r);
    this.ctx.quadraticCurveTo(
      px + pw,
      paddleTop + PADDLE_HEIGHT,
      px + pw - r,
      paddleTop + PADDLE_HEIGHT
    );
    this.ctx.lineTo(px + r, paddleTop + PADDLE_HEIGHT);
    this.ctx.quadraticCurveTo(px, paddleTop + PADDLE_HEIGHT, px, paddleTop + PADDLE_HEIGHT - r);
    this.ctx.lineTo(px, paddleTop + r);
    this.ctx.quadraticCurveTo(px, paddleTop, px + r, paddleTop);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
