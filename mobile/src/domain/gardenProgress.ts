type NextUnlockProgressArgs = {
  earnedPoints: number;
  requiredPoints: number;
};

type GardenItemLike = {
  required_points?: number | null;
  requiredPoints?: number | null;
};

const BASE_REQUIRED_POINTS = 6;
const REQUIRED_POINTS_STEP = 3;

export function getRequiredPointsForNextUnlock(unlockedCount: number, nextLockedItem?: GardenItemLike | null): number {
  const explicitRequired = Number(nextLockedItem?.required_points ?? nextLockedItem?.requiredPoints);
  if (Number.isFinite(explicitRequired)) {
    return Math.max(1, Math.floor(explicitRequired));
  }

  const safeUnlocked = Number.isFinite(unlockedCount) ? Math.max(0, Math.floor(unlockedCount)) : 0;
  return BASE_REQUIRED_POINTS + safeUnlocked * REQUIRED_POINTS_STEP;
}

export function getNextUnlockProgress(args: NextUnlockProgressArgs) {
  const earnedPoints = Number.isFinite(args.earnedPoints) ? Math.max(0, Math.floor(args.earnedPoints)) : 0;
  const requiredPoints = Number.isFinite(args.requiredPoints) ? Math.max(1, Math.floor(args.requiredPoints)) : 1;
  const remaining = Math.max(requiredPoints - earnedPoints, 0);
  const isReady = earnedPoints >= requiredPoints;
  return { earnedPoints, requiredPoints, remaining, isReady };
}
