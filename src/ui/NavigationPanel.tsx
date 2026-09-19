import { useWorldStore } from "../store/worldStore";
import { GUIDE_LOCAL, PORTAL_LOCAL, COMMAND_CENTER_LOCAL } from "../world/landmarks";
import { navigateTo } from "../world/autoNavActions";
import "./NavigationPanel.css";

const DESTINATIONS = [
  { id: "guide", label: "The Guide", key: "1", pos: GUIDE_LOCAL },
  { id: "portal", label: "Bridge Portal", key: "2", pos: PORTAL_LOCAL },
  { id: "command_center", label: "Command Center", key: "3", pos: COMMAND_CENTER_LOCAL },
] as const;

export function NavigationPanel() {
  const playerLocal = useWorldStore((s) => s.playerLocal);
  const autoNav = useWorldStore((s) => s.autoNav);
  const inInterstellar = useWorldStore((s) => s.inInterstellar);

  if (inInterstellar) return null;

  return (
    <div className="nav-panel">
      {autoNav ? (
        <div className="nav-active">
          <span>walking to {autoNav.label}…</span>
          <button onClick={() => useWorldStore.getState().cancelAutoNav()}>cancel</button>
        </div>
      ) : (
        <div className="nav-destinations">
          {DESTINATIONS.map((d) => {
            const dist = Math.hypot(d.pos[0] - playerLocal[0], d.pos[1] - playerLocal[1]);
            return (
              <button key={d.id} className="nav-dest-btn" onClick={() => navigateTo(d.label, d.pos)}>
                <span>[{d.key}] {d.label}</span>
                <span className="nav-dist">{Math.round(dist)}m</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
