import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function PaperLabLoading() {
  return (
    <>
      <LoadingSkeleton className="mb-4 h-14 w-full rounded-lg" />
      <LoadingSkeletonGroup rows={4} className="mb-4" />
      <LoadingSkeletonGroup rows={6} />
    </>
  );
}
