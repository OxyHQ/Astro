import "rrweb-player/dist/style.css";
import Player from "rrweb-player";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type ReplayPlayerHandle = { seek: (timestamp: number) => void };

type RecordedEvent = { timestamp: number; type: number };

const CONTROLLER_HEIGHT = 80;

const ReplayPlayer = forwardRef<ReplayPlayerHandle, { events: RecordedEvent[] }>(function ReplayPlayer({ events }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const firstTimestamp = events[0]?.timestamp ?? 0;

  useImperativeHandle(ref, () => ({
    seek: (timestamp: number) => player.current?.goto(Math.max(0, timestamp - firstTimestamp), true),
  }));

  useEffect(() => {
    const target = host.current;
    if (!target || events.length < 2) return;
    const size = () => {
      const width = Math.max(280, Math.floor(target.clientWidth));
      return { width, height: Math.round(Math.min(width * 0.62, window.innerHeight * 0.68)) };
    };
    const instance = new Player({
      target,
      props: {
        events: events as never,
        ...size(),
        autoPlay: false,
        skipInactive: true,
        showController: true,
        speedOption: [1, 2, 4, 8],
        inactiveColor: "var(--muted-foreground)",
        mouseTail: { strokeStyle: "#fbb927", lineWidth: 2, duration: 500 },
        UNSAFE_replayCanvas: false,
      },
    });
    player.current = instance;
    const svelte = instance as unknown as { $set: (props: Record<string, unknown>) => void; $destroy: () => void };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        svelte.$set(size());
        instance.triggerResize();
      });
    });
    observer.observe(target);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      instance.pause();
      svelte.$destroy();
      player.current = null;
      target.replaceChildren();
    };
  }, [events]);

  return <div ref={host} className="astro-replay w-full" style={{ minHeight: CONTROLLER_HEIGHT }} />;
});

export default ReplayPlayer;
