"use client";

type Props = {
  widthPercent: number;
  label?: string;
  reducedMotion?: boolean;
};

export function PlasmaProgressBar({ widthPercent, label, reducedMotion = false }: Props) {
  const clamped = Math.max(0, Math.min(100, widthPercent));

  return (
    <div
      className="ccd-plasma"
      role="img"
      aria-label={label ?? `Progress ${clamped}%`}
    >
      <div className="ccd-plasma__fill" style={{ width: `${clamped}%` }}>
        {!reducedMotion ? <div className="ccd-plasma__mask" aria-hidden /> : null}
      </div>
    </div>
  );
}
