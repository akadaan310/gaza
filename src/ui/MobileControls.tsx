import { useRef, useState } from "react";
import { mobileMoveInput, mobileLookDelta } from "../player/FirstPersonController";
import "./MobileControls.css";

const JOYSTICK_RADIUS = 52;

export function MobileControls({ onInteract, onToggleResearch }: { onInteract: () => void; onToggleResearch: () => void }) {
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const moveTouchId = useRef<number | null>(null);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);

  function handleTouchStart(e: React.TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      const isLeft = t.clientX < window.innerWidth / 2;
      if (isLeft && moveTouchId.current === null) {
        moveTouchId.current = t.identifier;
        moveOrigin.current = { x: t.clientX, y: t.clientY };
        setStickPos({ x: 0, y: 0 });
      } else if (!isLeft && lookTouchId.current === null) {
        lookTouchId.current = t.identifier;
        lookLast.current = { x: t.clientX, y: t.clientY };
      }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveTouchId.current) {
        let dx = t.clientX - moveOrigin.current.x;
        let dy = t.clientY - moveOrigin.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist > JOYSTICK_RADIUS) {
          dx = (dx / dist) * JOYSTICK_RADIUS;
          dy = (dy / dist) * JOYSTICK_RADIUS;
        }
        setStickPos({ x: dx, y: dy });
        mobileMoveInput.x = dx / JOYSTICK_RADIUS;
        mobileMoveInput.y = -dy / JOYSTICK_RADIUS;
      } else if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lookLast.current.x;
        const dy = t.clientY - lookLast.current.y;
        mobileLookDelta.dx += dx;
        mobileLookDelta.dy += dy;
        lookLast.current = { x: t.clientX, y: t.clientY };
      }
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveTouchId.current) {
        moveTouchId.current = null;
        setStickPos({ x: 0, y: 0 });
        mobileMoveInput.x = 0;
        mobileMoveInput.y = 0;
      } else if (t.identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  }

  return (
    <div
      className="mobile-controls-surface"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="joystick-base">
        <div
          className="joystick-stick"
          style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
        />
      </div>
      <div className="mobile-action-buttons">
        <button
          className="mobile-btn run-btn"
          onTouchStart={(e) => {
            e.stopPropagation();
            setRunning((r) => {
              mobileMoveInput.running = !r;
              return !r;
            });
          }}
        >
          {running ? "RUN" : "walk"}
        </button>
        <button
          className="mobile-btn interact-btn"
          onTouchStart={(e) => {
            e.stopPropagation();
            onInteract();
          }}
        >
          ◆
        </button>
        <button
          className="mobile-btn research-btn"
          onTouchStart={(e) => {
            e.stopPropagation();
            onToggleResearch();
          }}
        >
          ⌬
        </button>
      </div>
    </div>
  );
}
