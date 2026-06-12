type Props = {
  active: boolean;
  label?: string;
};

export function StatusPill({ active, label }: Props) {
  return (
    <span
      className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
        active
          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
          : "bg-slate-600/80"
      }`}
      aria-hidden={!label}
      title={label}
    />
  );
}
