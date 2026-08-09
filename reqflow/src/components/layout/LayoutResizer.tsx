import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface LayoutResizerProps {
  className: string;
  label: string;
  width: number;
  direction: "increase" | "decrease";
  onResize: (width: number) => void;
}

export function LayoutResizer({ className, label, width, direction, onResize }: LayoutResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const multiplier = direction === "increase" ? 1 : -1;

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("resizing-panel");
    return () => document.body.classList.remove("resizing-panel");
  }, [dragging]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    onResize(drag.current.startWidth + multiplier * (event.clientX - drag.current.startX));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 16 : -16;
    onResize(width + multiplier * delta);
  }

  return <div className={`${className} ${dragging ? "is-dragging" : ""}`} role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />;
}
