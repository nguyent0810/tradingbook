"use client";

export function PaperLabHelpIcon({ text }: { text: string }) {
  return (
    <span
      className="paper-lab-help-icon"
      title={text}
      aria-label={text}
      role="img"
    >
      ?
    </span>
  );
}
