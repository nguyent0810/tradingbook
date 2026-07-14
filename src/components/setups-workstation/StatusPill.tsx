type Props = {
  active: boolean;
  label?: string;
};

export function StatusPill({ active, label }: Props) {
  return (
    <span
      className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
        active
          ? "!bg-[var(--status-healthy)] !shadow-[0_0_8px_var(--status-healthy-border)]"
          : "!bg-[var(--text-muted)]"
      }`}
      aria-hidden={!label}
      title={label}
    />
  );
}
