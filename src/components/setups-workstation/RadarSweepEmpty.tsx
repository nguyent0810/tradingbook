import "./setups-workstation.css";

type Props = {
  "data-testid"?: string;
};

export function RadarSweepEmpty({ "data-testid": testId = "setups-radar-sweep" }: Props) {
  return (
    <div
      className="relative mx-auto flex h-32 w-32 items-center justify-center"
      data-testid={testId}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full border border-cyan-500/20" />
      <div className="absolute inset-3 rounded-full border border-cyan-500/10" />
      <div className="absolute inset-6 rounded-full border border-cyan-500/5" />
      <div
        className="sw-radar-sweep__ring absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.35) 40deg, transparent 80deg)",
        }}
      />
      <div className="h-2 w-2 rounded-full bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
    </div>
  );
}
