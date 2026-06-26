import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import { PaperLabPageShell } from "@/components/paper-lab/PaperLabPageShell";

export default function PaperLabLoading() {
  return (
    <PaperLabPageShell>
      <LoadingSkeleton className="mb-4 h-14 w-full rounded-lg" />
      <LoadingSkeletonGroup rows={4} className="mb-4" />
      <LoadingSkeletonGroup rows={6} />
    </PaperLabPageShell>
  );
}
