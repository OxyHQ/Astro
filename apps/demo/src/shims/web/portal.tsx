import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { View } from "react-native";
import { create } from "zustand";
import type { PortalHostProps, PortalProps } from "@astro-browser-real/shell";

const useHosts = create<{ hosts: Record<string, Element> }>()(() => ({ hosts: {} }));

export function PortalHost({ name, ...props }: PortalHostProps) {
  const [element, setElement] = useState<Element | null>(null);
  const ref = useCallback((node: unknown) => setElement(node instanceof Element ? node : null), []);
  useEffect(() => {
    if (!element) return;
    useHosts.setState((s) => ({ hosts: { ...s.hosts, [name]: element } }));
    return () =>
      useHosts.setState((s) => {
        if (s.hosts[name] !== element) return s;
        const { [name]: _gone, ...hosts } = s.hosts;
        return { hosts };
      });
  }, [name, element]);
  return <View ref={ref as never} {...props} />;
}

export function Portal({ host, containerRef, children }: PortalProps) {
  const target = useHosts((s) => (host ? (s.hosts[host] ?? null) : null));
  const container = useMemo(() => {
    const div = document.createElement("div");
    div.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;";
    return div;
  }, []);
  useEffect(() => {
    containerRef?.(container);
    return () => containerRef?.(null);
  }, [container, containerRef]);
  useEffect(() => {
    if (target && container.parentElement !== target) target.appendChild(container);
    else if (!target && container.parentElement) container.remove();
  }, [target, container]);
  useEffect(() => () => container.remove(), [container]);
  return createPortal(children, container);
}
