import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-lg bg-[#1f2f3f]",
            className
          )}
        />
      ))}
    </>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex gap-3 px-3 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-2 py-2">
      <Skeleton className="h-10 w-32 rounded-2xl" />
    </div>
  );
}
