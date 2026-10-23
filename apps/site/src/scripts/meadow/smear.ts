const HEAL_SECONDS = 0.45;
const MAX_SHIFT = 0.045;
const SETTLED_SHIFT = 3e-4;

export class WetPaint {
  readonly columns: number;
  readonly rows: number;
  readonly field: Float32Array;
  private readonly last = { x: 0, y: 0, set: false };
  private idle = 0;

  constructor(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
    this.field = new Float32Array(columns * rows * 2);
  }

  get settled() {
    return this.idle > 4;
  }

  step(dt: number, pointer: { x: number; y: number; active: boolean }, width: number, height: number, radiusPx: number) {
    const { columns, rows, field } = this;
    const heal = Math.exp(-dt / HEAL_SECONDS);
    let peak = 0;
    for (let i = 0; i < field.length; i++) {
      field[i] *= heal;
      peak = Math.max(peak, Math.abs(field[i]));
    }
    const last = this.last;
    this.idle = peak < SETTLED_SHIFT ? this.idle + 1 : 0;
    if (!pointer.active || dt <= 0) {
      last.set = false;
      return;
    }
    const hadLast = last.set;
    const moveX = (pointer.x - last.x) / width;
    const moveY = -(pointer.y - last.y) / height;
    last.x = pointer.x;
    last.y = pointer.y;
    last.set = true;
    if (!hadLast) return;
    if (Math.abs(moveX) + Math.abs(moveY) < 1e-5) return;
    this.idle = 0;
    const centerU = pointer.x / width;
    const centerV = 1 - pointer.y / height;
    for (let row = 0; row < rows; row++) {
      const dy = ((row + 0.5) / rows - centerV) * height;
      if (Math.abs(dy) > radiusPx) continue;
      for (let col = 0; col < columns; col++) {
        const dx = ((col + 0.5) / columns - centerU) * width;
        const distance = Math.hypot(dx, dy);
        if (distance > radiusPx) continue;
        const t = 1 - distance / radiusPx;
        const falloff = t * t * (3 - 2 * t);
        const index = (row * columns + col) * 2;
        field[index] = clamp(field[index] + moveX * falloff * 0.6);
        field[index + 1] = clamp(field[index + 1] + moveY * falloff * 0.6);
      }
    }
  }
}

function clamp(value: number) {
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, value));
}
