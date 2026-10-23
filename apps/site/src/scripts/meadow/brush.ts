export interface BrushTouch {
  u: number;
  v: number;
  active: boolean;
}

export const BRUSH_CHANNELS = 4;

const PRESS_STIFFNESS = 520;
const PRESS_DAMPING = 46;
const HOLD_SECONDS = 0.85;
const HOLD_RATE = 1;
const SPRING_RATE = 7;
const COUPLING = 4;
const MAX_BEND = 1.55;
const GLOW_SECONDS = 3.4;

export class GrassBrush {
  readonly columns: number;
  readonly rows: number;
  readonly field: Float32Array;
  private readonly velocity: Float32Array;
  private readonly hold: Float32Array;
  private readonly previous: BrushTouch = { u: 0, v: 0, active: false };
  private idleFrames = 0;
  private glowing = false;

  constructor(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
    this.field = new Float32Array(columns * rows * BRUSH_CHANNELS);
    this.velocity = new Float32Array(columns * rows * 2);
    this.hold = new Float32Array(columns * rows);
  }

  get settled() {
    return this.idleFrames > 8;
  }

  get resting() {
    return this.settled && !this.glowing;
  }

  step(dt: number, touch: BrushTouch, widthPx: number, heightPx: number, radiusPx: number) {
    const { columns, rows, field, velocity, hold } = this;
    const previous = this.previous;
    let dragU = 0;
    let dragV = 0;
    if (touch.active && previous.active && dt > 0) {
      dragU = ((touch.u - previous.u) * widthPx) / dt;
      dragV = ((touch.v - previous.v) * heightPx) / dt;
    }
    previous.u = touch.u;
    previous.v = touch.v;
    previous.active = touch.active;
    const dragSpeed = Math.min(Math.hypot(dragU, dragV), 3000);
    const rustle = dragSpeed > 1 ? Math.min(dragSpeed / 700, 2) / dragSpeed : 0;
    const reach = radiusPx * (1 + Math.min(dragSpeed / 2400, 0.5));
    const glowFade = Math.exp(-dt / GLOW_SECONDS);
    let change = 0;
    let glowing = false;

    for (let row = 0; row < rows; row++) {
      const cellV = (row + 0.5) / rows;
      for (let col = 0; col < columns; col++) {
        const cell = row * columns + col;
        const index = cell * BRUSH_CHANNELS;
        const motion = cell * 2;
        let targetX = 0;
        let targetZ = 0;
        let pressed = 0;
        if (touch.active) {
          const dx = ((col + 0.5) / columns - touch.u) * widthPx;
          const dy = (cellV - touch.v) * heightPx;
          const distance = Math.hypot(dx, dy);
          if (distance < reach) {
            const t = 1 - distance / reach;
            pressed = t * t * (3 - 2 * t);
            const lift = Math.min(1, distance / (reach * 0.12));
            const strength = 1.45 * Math.min(1, pressed * 1.7) * lift;
            targetX = (dx / (distance || 1)) * strength;
            targetZ = (dy / (distance || 1)) * strength;
          }
        }
        const pressing = pressed > 0.02;
        hold[cell] = pressing ? Math.max(hold[cell], HOLD_SECONDS * Math.min(1, pressed * 2)) : Math.max(0, hold[cell] - dt);
        const holding = Math.min(1, hold[cell] / 0.12);
        const rate = SPRING_RATE + (HOLD_RATE - SPRING_RATE) * holding;
        const recoveryStiffness = rate * rate;
        const recoveryDamping = 2 * rate;
        const stiffness = pressing ? PRESS_STIFFNESS * pressed + recoveryStiffness : recoveryStiffness;
        const damping = pressing ? PRESS_DAMPING * Math.sqrt(pressed) + recoveryDamping : recoveryDamping;
        const left = col > 0 ? index - BRUSH_CHANNELS : index;
        const right = col < columns - 1 ? index + BRUSH_CHANNELS : index;
        const down = row > 0 ? index - columns * BRUSH_CHANNELS : index;
        const up = row < rows - 1 ? index + columns * BRUSH_CHANNELS : index;
        for (let axis = 0; axis < 2; axis++) {
          const current = field[index + axis];
          const neighbors = (field[left + axis] + field[right + axis] + field[down + axis] + field[up + axis]) * 0.25;
          const target = axis === 0 ? targetX : targetZ;
          const kick = (axis === 0 ? dragU : dragV) * rustle * pressed;
          const accel = stiffness * (target - current) - damping * velocity[motion + axis] + COUPLING * (neighbors - current);
          velocity[motion + axis] += accel * dt + kick * 14 * dt;
          const next = Math.max(-MAX_BEND, Math.min(MAX_BEND, current + velocity[motion + axis] * dt));
          field[index + axis] = next;
          change += Math.abs(next - current) + Math.abs(velocity[motion + axis]) * 0.01;
        }
        const glow = Math.max(field[index + 2] * glowFade, pressed * pressed);
        const nextGlow = glow < 0.004 ? 0 : glow;
        glowing ||= nextGlow > 0;
        field[index + 2] = nextGlow;
      }
    }
    this.idleFrames = change < 0.004 ? this.idleFrames + 1 : 0;
    this.glowing = glowing;
  }
}
