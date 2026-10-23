const FIREFLY_COUNT = 34;
const PETAL_LIMIT = 90;
const SPARK_LIMIT = 70;
const FLOATS_PER_PARTICLE = 9;
const PETAL_COLORS: [number, number, number][] = [
  [0.95, 0.66, 0.72],
  [0.98, 0.95, 0.88],
  [0.96, 0.77, 0.27],
  [0.73, 0.64, 0.86],
  [0.93, 0.49, 0.42],
];

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  angle: number;
  spin: number;
  size: number;
  color: [number, number, number];
}

export class Particles {
  readonly data = new Float32Array((FIREFLY_COUNT + PETAL_LIMIT + SPARK_LIMIT) * FLOATS_PER_PARTICLE);
  private readonly fireflies: Firefly[] = [];
  private readonly petals: Petal[] = [];
  private readonly sparks: Spark[] = [];
  private sparkDebt = 0;
  private width = 1;
  private height = 1;
  private time = 0;

  get busy() {
    return this.petals.length > 0 || this.sparks.length > 0;
  }

  sparkle(dt: number, x: number, y: number, speed: number, night: number) {
    if (night < 0.5 || speed < 40) return;
    this.sparkDebt += dt * Math.min(speed / 500, 1.6) * 34 * night;
    while (this.sparkDebt >= 1) {
      this.sparkDebt -= 1;
      if (this.sparks.length >= SPARK_LIMIT) this.sparks.shift();
      const angle = Math.random() * Math.PI * 2;
      const reach = 18 + Math.random() * 46;
      this.sparks.push({
        x: x + Math.cos(angle) * reach,
        y: y + Math.sin(angle) * reach * 0.45,
        vx: (Math.random() - 0.5) * 24,
        vy: -12 - Math.random() * 30,
        age: 0,
        life: 0.45 + Math.random() * 0.6,
        size: 7 + Math.random() * 9,
      });
    }
  }

  resize(width: number, height: number) {
    if (this.fireflies.length === 0) {
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        this.fireflies.push({
          x: Math.random() * width,
          y: height * (0.45 + Math.random() * 0.45),
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 0.8,
        });
      }
    } else {
      for (const fly of this.fireflies) {
        fly.x *= width / this.width;
        fly.y *= height / this.height;
      }
    }
    this.width = width;
    this.height = height;
  }

  burst(x: number, y: number, night: number) {
    for (const fly of this.fireflies) {
      const dx = fly.x - x;
      const dy = fly.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 260) {
        const push = (1 - distance / 260) * 520;
        fly.vx += (dx / distance) * push;
        fly.vy += (dy / distance) * push - 80;
      }
    }
    if (night > 0.6) return;
    const count = 16;
    for (let i = 0; i < count; i++) {
      if (this.petals.length >= PETAL_LIMIT) this.petals.shift();
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 180 + Math.random() * 320;
      this.petals.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 1.8 + Math.random() * 1.4,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 9,
        size: 9 + Math.random() * 8,
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      });
    }
  }

  step(dt: number, night: number, pointer: { x: number; y: number; active: boolean }) {
    this.time += dt;
    const { width, height } = this;
    for (const fly of this.fireflies) {
      const t = this.time * fly.speed + fly.phase;
      fly.vx += (Math.sin(t * 1.3) * 22 + Math.cos(t * 0.7 + fly.phase) * 14) * dt;
      fly.vy += (Math.cos(t * 1.1) * 16 - 9) * dt;
      if (pointer.active && night > 0.3) {
        const dx = fly.x - pointer.x;
        const dy = fly.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 120) {
          fly.vx += (dx / distance) * 240 * dt;
          fly.vy += (dy / distance) * 240 * dt;
        }
      }
      const drag = Math.exp(-dt * 1.6);
      fly.vx *= drag;
      fly.vy *= drag;
      fly.x += fly.vx * dt;
      fly.y += fly.vy * dt;
      if (fly.y < height * 0.3) fly.y = height * 0.95;
      if (fly.y > height) fly.y = height * 0.45;
      if (fly.x < -20) fly.x = width + 20;
      if (fly.x > width + 20) fly.x = -20;
    }
    for (const petal of this.petals) {
      petal.age += dt;
      const drag = Math.exp(-dt * 2.2);
      petal.vx = petal.vx * drag + Math.sin(petal.age * 5 + petal.angle) * 60 * dt;
      petal.vy = petal.vy * drag + 260 * dt;
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.angle += petal.spin * dt;
    }
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      if (this.sparks[i].age > this.sparks[i].life) this.sparks.splice(i, 1);
    }
    for (let i = this.petals.length - 1; i >= 0; i--) {
      if (this.petals[i].age > this.petals[i].life) this.petals.splice(i, 1);
    }
  }

  fill(scale: number, night: number, shade: (x: number, y: number) => number = () => 1) {
    const { data } = this;
    let cursor = 0;
    const write = (x: number, y: number, size: number, angle: number, r: number, g: number, b: number, a: number, kind: number) => {
      data[cursor] = x * scale;
      data[cursor + 1] = y * scale;
      data[cursor + 2] = size * scale;
      data[cursor + 3] = angle;
      data[cursor + 4] = r;
      data[cursor + 5] = g;
      data[cursor + 6] = b;
      data[cursor + 7] = a;
      data[cursor + 8] = kind;
      cursor += FLOATS_PER_PARTICLE;
    };
    if (night > 0.02) {
      for (const fly of this.fireflies) {
        const blink = Math.max(0, Math.sin(this.time * 1.7 * fly.speed + fly.phase * 3)) ** 2;
        const glow = night * (0.25 + 0.75 * blink) * shade(fly.x, fly.y);
        write(fly.x, fly.y, 22 + 10 * blink, 0, 0.9 * glow, 1 * glow, 0.45 * glow, 0, 0);
      }
    }
    for (const spark of this.sparks) {
      const t = spark.age / spark.life;
      const flash = Math.min(1, t / 0.12) * (1 - t) * (1 - t) * night * shade(spark.x, spark.y);
      write(spark.x, spark.y, spark.size * (0.7 + 0.5 * (1 - t)), 0, 0.9 * flash, 1 * flash, 0.92 * flash, 0, 0);
    }
    for (const petal of this.petals) {
      const fade = Math.min(1, (petal.life - petal.age) / 0.6) * Math.min(1, petal.age / 0.05);
      write(petal.x, petal.y, petal.size, petal.angle, petal.color[0] * fade, petal.color[1] * fade, petal.color[2] * fade, fade, 1);
    }
    return cursor / FLOATS_PER_PARTICLE;
  }
}

export const PARTICLE_STRIDE = FLOATS_PER_PARTICLE * 4;
