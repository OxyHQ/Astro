import { Mesh, Program, Renderer, Triangle, Vec2 } from "ogl";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uTheme;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = (st - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * 0.12;
  uv *= rot(0.06 * sin(t * 1.7));
  vec2 p = uv * 1.1;
  float n = fbm(p + vec2(t * 0.8, -t * 0.55));
  float m = fbm(p * 1.8 - vec2(t * 0.35, t * 0.7));
  float n2 = fbm(p * 0.6 + vec2(-t * 0.3, t * 0.4) + n * 0.5);
  float w = 0.5 * (sin(p.x * 2.2 + t * 2.4 + n * 2.0) + cos(p.y * 1.7 - t * 1.8 + m * 2.2));
  float bands = 0.5 + 0.5 * sin(w * 2.4 + n * 3.2);
  float glow = max(smoothstep(0.15, 0.85, bands), smoothstep(0.3, 0.8, n2) * 0.6);

  vec3 lightA = vec3(0.945, 0.925, 0.886);
  vec3 lightB = vec3(0.949, 0.827, 0.608);
  vec3 lightC = vec3(0.851, 0.600, 0.545);
  vec3 darkA = vec3(0.067, 0.094, 0.169);
  vec3 darkB = vec3(0.173, 0.255, 0.424);
  vec3 darkC = vec3(0.365, 0.322, 0.506);

  vec3 a = mix(lightA, darkA, uTheme);
  vec3 b = mix(lightB, darkB, uTheme);
  vec3 c = mix(lightC, darkC, uTheme);
  vec3 col = mix(a, b, glow * mix(0.75, 0.6, uTheme));
  col = mix(col, c, smoothstep(0.55, 1.0, n2) * 0.35 * (1.0 - st.y));
  col += (hash(gl_FragCoord.xy + uTime * 60.0) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function CloudBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: Renderer;
    let program: Program;
    let mesh: Mesh;
    try {
      renderer = new Renderer({ canvas, alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
      const context = renderer.gl;
      if (!context || context.isContextLost()) return;
      program = new Program(context, {
        vertex,
        fragment,
        uniforms: { uTime: { value: 8 }, uResolution: { value: new Vec2(1, 1) }, uTheme: { value: dark.matches ? 1 : 0 } },
      });
      if (!context.getProgramParameter(program.program, context.LINK_STATUS)) return;
      mesh = new Mesh(context, { geometry: new Triangle(context), program });
      renderer.render({ scene: mesh });
    } catch {
      return;
    }
    const gl = renderer.gl;
    canvas.dataset.ready = "true";

    let frame = 0;
    const draw = () => renderer.render({ scene: mesh });
    const resize = () => {
      if (!parent.clientWidth || !parent.clientHeight) return;
      renderer.setSize(parent.clientWidth, parent.clientHeight);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      program.uniforms.uResolution.value.set(gl.drawingBufferWidth, gl.drawingBufferHeight);
      draw();
    };
    const onTheme = () => {
      program.uniforms.uTheme.value = dark.matches ? 1 : 0;
      draw();
    };
    const onLost = () => {
      canvas.dataset.ready = "false";
      cancelAnimationFrame(frame);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    dark.addEventListener("change", onTheme);
    resize();

    const start = performance.now();
    const loop = () => {
      program.uniforms.uTime.value = 8 + (performance.now() - start) / 1000;
      draw();
      frame = requestAnimationFrame(loop);
    };
    if (!still.matches) frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", onLost);
      observer.disconnect();
      dark.removeEventListener("change", onTheme);
    };
  }, []);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="sky-wash absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100" />
    </div>
  );
}
