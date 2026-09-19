import { useWorldStore } from "../store/worldStore";
import { CLASSIFICATION_LABEL, CLASSIFICATION_COLOR } from "../data/provenance";
import "./ResearchPanel.css";

export function ResearchPanel() {
  const researchMode = useWorldStore((s) => s.researchMode);
  const focus = useWorldStore((s) => s.focus);

  if (!researchMode) return null;

  return (
    <div className="research-panel">
      <div className="research-panel-title">RESEARCH MODE</div>
      {focus ? (
        <div className="research-card">
          <div
            className="research-badge"
            style={{ color: CLASSIFICATION_COLOR[focus.provenance.classification] }}
          >
            {CLASSIFICATION_LABEL[focus.provenance.classification]}
          </div>
          <div className="research-label">{focus.label}</div>
          {focus.provenance.source && (
            <div className="research-source">
              {focus.provenance.source.attribution}
              {focus.provenance.source.fetchedAt && ` · fetched ${focus.provenance.source.fetchedAt}`}
            </div>
          )}
          {focus.provenance.algorithm && (
            <div className="research-source">algorithm: {focus.provenance.algorithm}</div>
          )}
          {focus.provenance.note && <div className="research-note">{focus.provenance.note}</div>}
          {focus.extra &&
            Object.entries(focus.extra).map(([k, v]) => (
              <div key={k} className="research-extra">
                {k}: {v}
              </div>
            ))}
        </div>
      ) : (
        <div className="research-card research-empty">
          Nothing in focus — approach a guide, portal, or command center.
        </div>
      )}
    </div>
  );
}
