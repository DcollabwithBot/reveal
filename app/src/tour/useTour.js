import { useContext } from "react";
import { TourContext } from "./TourProvider.jsx";

/**
 * Hook to access tour context.
 *
 * Usage:
 *   const { startTour, skipTour, isActive, currentStep, mode } = useTour();
 *
 * startTour(mode, { onComplete, onSkip })
 *   mode: 'demo' | 'onboarding' | 'explore'
 */
export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // Graceful fallback — tour context not mounted (e.g. in unit tests)
    return {
      startTour: () => {},
      skipTour: () => {},
      isActive: false,
      currentStep: 0,
      mode: null,
    };
  }
  return ctx;
}
