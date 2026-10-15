import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface LayoutResizerProps {
  className: string;
  label: string;
  width: number;
  direction: "increase" | "decrease";
  onResize: (width: number) => void;
  onKeyboardResize?: (width: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  dragResetKey?: number;
  valueMin?: number;
  valueMax?: number;
}

export function LayoutResizer({ className, label, width, direction, onResize, onKeyboardResize, onDraggingChange, dragResetKey, valueMin, valueMax }: LayoutResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const lastPointerX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const multiplier = direction === "increase" ? 1 : -1;

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("resizing-panel");
    return () => document.body.classList.remove("resizing-panel");
  }, [dragging]);

  useEffect(() => {
    if (!dragging || !drag.current || lastPointerX.current === null) return;
    drag.current = { startX: lastPointerX.current, startWidth: width };
  }, [dragResetKey]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
    lastPointerX.current = event.clientX;
    setDragging(true);
    onDraggingChange?.(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    lastPointerX.current = event.clientX;
    onResize(drag.current.startWidth + multiplier * (event.clientX - drag.current.startX));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    lastPointerX.current = null;
    setDragging(false);
    onDraggingChange?.(false);
    const target = event.currentTarget as HTMLDivElement & {
      hasPointerCapture?: (pointerId: number) => boolean;
      releasePointerCapture?: (pointerId: number) => void;
    };
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture?.(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 16 : -16;
    (onKeyboardResize ?? onResize)(width + multiplier * delta);
  }

  return <div className={`${className} ${dragging ? "is-dragging" : ""}`} role="separator" aria-orientation="vertical" aria-label={label} aria-valuemin={valueMin} aria-valuemax={valueMax} aria-valuenow={valueMin === undefined ? undefined : width} tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />;
}
