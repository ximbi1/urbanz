import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

type SkeletonType = 'runs' | 'notifications' | 'friends' | 'ranking' | 'achievements' | 'challenges' | 'profile' | 'map';

interface ContentSkeletonProps {
  type: SkeletonType;
  count?: number;
  className?: string;
}

const RunCardSkeleton = () => (
  <div className="p-4 rounded-lg border border-border bg-card space-y-3">
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-32" />
    </div>
    <div className="grid grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
    <div className="flex gap-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const NotificationSkeleton = () => (
  <div className="p-4 rounded-lg border border-border bg-card flex gap-3">
    <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

const FriendSkeleton = () => (
  <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
    <Skeleton className="h-8 w-8 rounded" />
  </div>
);

const RankingSkeleton = () => (
  <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
    <Skeleton className="h-8 w-8 rounded-full" />
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-1">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="h-5 w-16" />
  </div>
);

const AchievementSkeleton = () => (
  <div className="p-4 rounded-lg border border-border bg-card flex items-center gap-4">
    <Skeleton className="h-12 w-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
    <Skeleton className="h-5 w-12" />
  </div>
);

const ChallengeSkeleton = () => (
  <div className="p-4 rounded-lg border border-border bg-card space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <Skeleton className="h-2 w-full rounded-full" />
    <div className="flex justify-between">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border bg-card text-center space-y-2">
          <Skeleton className="h-6 w-16 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

const MapSkeleton = () => (
  <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-muted/30">
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    {/* Fake map grid lines */}
    <div className="absolute inset-0 opacity-10">
      {[...Array(8)].map((_, i) => (
        <div 
          key={`h-${i}`} 
          className="absolute w-full h-px bg-border" 
          style={{ top: `${(i + 1) * 12.5}%` }} 
        />
      ))}
      {[...Array(8)].map((_, i) => (
        <div 
          key={`v-${i}`} 
          className="absolute h-full w-px bg-border" 
          style={{ left: `${(i + 1) * 12.5}%` }} 
        />
      ))}
    </div>
  </div>
);

const skeletonComponents: Record<SkeletonType, React.FC> = {
  runs: RunCardSkeleton,
  notifications: NotificationSkeleton,
  friends: FriendSkeleton,
  ranking: RankingSkeleton,
  achievements: AchievementSkeleton,
  challenges: ChallengeSkeleton,
  profile: ProfileSkeleton,
  map: MapSkeleton,
};

export const ContentSkeleton = ({ type, count = 3, className }: ContentSkeletonProps) => {
  const SkeletonComponent = skeletonComponents[type];
  
  // Special case for single components like profile and map
  if (type === 'profile' || type === 'map') {
    return (
      <div className={cn('animate-in fade-in duration-300', className)}>
        <SkeletonComponent />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 animate-in fade-in duration-300', className)}>
      {[...Array(count)].map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
};
