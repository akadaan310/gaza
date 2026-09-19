import { useMemo } from "react";
import { useWorldStore } from "../store/worldStore";
import { localToLonLat } from "../world/geo";
import { CLASSIFICATION_LABEL } from "../data/provenance";
import "./CommandCenterPanel.css";

export function CommandCenterPanel() {
  const open = useWorldStore((s) => s.commandCenterOpen);
  const playerLocal = useWorldStore((s) => s.playerLocal);
  const discovered = useWorldStore((s) => s.discovered);
  const realTiles = useWorldStore((s) => s.loadedRealTiles);
  const proceduralTiles = useWorldStore((s) => s.loadedProceduralTiles);
  const activeRelation = useWorldStore((s) => s.activeRelation);

  const stats = useMemo(() => {
    let realBuildings = 0, derivedBuildings = 0;
    for (const t of realTiles.values()) {
      for (const b of t.buildings) {
        if (b.provenance.classification === "REAL_DATA") realBuildings++;
        else derivedBuildings++;
      }
    }
    let proceduralBuildings = 0;
    for (const t of proceduralTiles.values()) proceduralBuildings += t.buildings.length;
    return { realBuildings, derivedBuildings, proceduralBuildings, realTileCount: realTiles.size };
  }, [realTiles, proceduralTiles]);

  if (!open) return null;

  const { lon, lat } = localToLonLat(playerLocal);

  return (
    <div className="command-center-overlay">
      <div className="command-center-panel">
        <div className="ccp-header">EARTH COMMAND CENTER</div>
        <div className="ccp-grid">
          <section>
            <h4>EARTH</h4>
            <p>lat {lat.toFixed(5)}, lon {lon.toFixed(5)}</p>
            <p>local ({playerLocal[0].toFixed(0)}m, {playerLocal[1].toFixed(0)}m) from Palestine Square</p>
          </section>
          <section>
            <h4>GAZA</h4>
            <p>{stats.realTileCount} real tile(s) loaded</p>
            <p>{stats.realBuildings} {CLASSIFICATION_LABEL.REAL_DATA.toLowerCase()} buildings</p>
            <p>{stats.derivedBuildings} {CLASSIFICATION_LABEL.DERIVED_DATA.toLowerCase()} (height estimated)</p>
            <p>{stats.proceduralBuildings} {CLASSIFICATION_LABEL.PROCEDURAL_OBJECT.toLowerCase()} (unmapped tiles)</p>
          </section>
          <section>
            <h4>RELATIONS</h4>
            {activeRelation ? (
              <>
                <p>root: {activeRelation.rootId}</p>
                <p>anchored to {activeRelation.buildingId}</p>
              </>
            ) : (
              <p>none discovered yet</p>
            )}
          </section>
          <section>
            <h4>DISCOVERED</h4>
            <p>{discovered.size} structure(s) encountered</p>
            <ul>
              {Array.from(discovered).map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="ccp-footer">
          Source: OpenStreetMap contributors (ODbL 1.0), fetched 2026-09-19 via Overpass API.
          Press ◆ / E again to close.
        </div>
      </div>
    </div>
  );
}
