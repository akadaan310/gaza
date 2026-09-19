import { useEffect, useState } from "react";
import { useWorldStore } from "../store/worldStore";
import { isTouchDevice } from "../player/FirstPersonController";
import "./IntroOverlay.css";

const LINES = ["I am here.", "Something is happening to this place.", "This place is becoming a computational universe."];

export function IntroOverlay() {
  const dismissed = useWorldStore((s) => s.introDismissed);
  const pointerLocked = useWorldStore((s) => s.pointerLocked);
  const [lineIndex, setLineIndex] = useState(0);
  const touch = isTouchDevice();

  useEffect(() => {
    if (dismissed) return;
    if (lineIndex >= LINES.length - 1) return;
    const t = setTimeout(() => setLineIndex((i) => i + 1), 2600);
    return () => clearTimeout(t);
  }, [lineIndex, dismissed]);

  useEffect(() => {
    if (touch) return;
    if (pointerLocked) useWorldStore.getState().dismissIntro();
  }, [pointerLocked, touch]);

  if (dismissed) return null;

  return (
    <div className="intro-overlay" onClick={() => touch && useWorldStore.getState().dismissIntro()}>
      <div className="intro-line" key={lineIndex}>
        {LINES[lineIndex]}
      </div>
      {lineIndex === LINES.length - 1 && (
        <div className="intro-prompt">{touch ? "tap to begin" : "click to look around, WASD to walk"}</div>
      )}
    </div>
  );
}
