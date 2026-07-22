"use client";

import { memo } from "react";

export const SETUPS_EVIDENCE_PREVIEW_COUNT = 6;

export type SetupsEvidenceItem = {
  key: string;
  text: string;
  tone: "ok" | "neutral";
};

export function buildSetupsEvidenceItems(
  reasonsLines: string[],
  healthLines: string[],
  marketContextLines: string[] = []
): SetupsEvidenceItem[] {
  return [
    ...reasonsLines.map((line) => ({
      key: `reason-${line}`,
      text: line,
      tone: "ok" as const,
    })),
    ...marketContextLines.map((line, i) => ({
      key: `context-${i}-${line}`,
      text: line,
      tone: "neutral" as const,
    })),
    ...healthLines.map((line, i) => ({
      key: `health-${i}`,
      text: line,
      tone: "neutral" as const,
    })),
  ].filter((item) => item.text.length > 0);
}

type SetupsCandidateEvidenceProps = {
  items: SetupsEvidenceItem[];
  previewCount?: number;
  onOpenTechnical?: () => void;
  technicalAvailable?: boolean;
};

export const SetupsCandidateEvidence = memo(function SetupsCandidateEvidence({
  items,
  previewCount = SETUPS_EVIDENCE_PREVIEW_COUNT,
  onOpenTechnical,
  technicalAvailable = false,
}: SetupsCandidateEvidenceProps) {
  if (items.length === 0) return null;

  const preview = items.slice(0, previewCount);
  const hiddenCount = items.length - preview.length;

  return (
    <section className="tosv3-setups-workstation-panel__section" aria-label="Surfaced evidence">
      <h4 className="tosv3-setups-workstation-panel__section-title">Bằng chứng</h4>
      <ul className="tosv3-setups-evidence-grid">
        {preview.map((item) => (
          <li
            key={item.key}
            className={`tosv3-setups-evidence-item${item.tone === "ok" ? " tosv3-setups-evidence-item--ok" : ""}`}
            title={item.text}
          >
            {item.text}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <p className="tosv3-setups-workstation-panel__more">
          còn {hiddenCount} mục nữa trong{" "}
          {technicalAvailable && onOpenTechnical ? (
            <button
              type="button"
              className="tosv3-setups-workstation-panel__more-link"
              onClick={onOpenTechnical}
            >
              bằng chứng kỹ thuật
            </button>
          ) : (
            "bằng chứng kỹ thuật"
          )}
        </p>
      ) : null}
    </section>
  );
});
