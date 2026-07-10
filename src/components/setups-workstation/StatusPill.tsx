type Props = {
  active: boolean;
  label?: string;
};

export function StatusPill({ active, label }: Props) {
  return (
    <span
      className="inline-flex h-2 w-2 shrink-0 rounded-full"
      style={{
        backgroundColor: active ? "var(--status-healthy)" : "var(--text-muted)",
        boxShadow: active ? "0 0 8px var(--status-healthy-border)" : "none",
      }}
      aria-hidden={!label}
      title={label}
    />
  );
}
