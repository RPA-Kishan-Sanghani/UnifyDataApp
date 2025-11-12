import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, Step } from 'react-joyride';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { tourSteps } from './tourSteps';

interface TourContextType {
  startTour: () => void;
  resetTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

interface TourProviderProps {
  children: ReactNode;
}

const TOUR_STORAGE_KEY = 'unifydata-tour-step';

export function TourProvider({ children }: TourProviderProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Fetch tour completion status from API
  const { data: tourStatus } = useQuery({
    queryKey: ['/api/user/tour-status'],
    retry: false,
  });

  // Mutation to mark tour as completed
  const completeTourMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/complete-tour');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/tour-status'] });
      localStorage.removeItem(TOUR_STORAGE_KEY);
    },
  });

  // Auto-start tour for new users
  useEffect(() => {
    if (tourStatus && tourStatus.tourCompleted === false) {
      // Check if we should auto-start
      const hasSeenTour = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!hasSeenTour) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          setRun(true);
        }, 1000);
      }
    }
  }, [tourStatus]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;

    // Store current step in localStorage for resume
    if (type === EVENTS.STEP_AFTER) {
      localStorage.setItem(TOUR_STORAGE_KEY, index.toString());
      setStepIndex(index + 1);
    }

    // Handle tour completion or skip
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      completeTourMutation.mutate();
    }

    console.log('Tour callback:', { status, type, index, action });
  };

  const startTour = () => {
    setStepIndex(0);
    setRun(true);
    localStorage.setItem(TOUR_STORAGE_KEY, '0');
  };

  const resetTour = () => {
    setStepIndex(0);
    setRun(false);
    localStorage.removeItem(TOUR_STORAGE_KEY);
  };

  const contextValue: TourContextType = {
    startTour,
    resetTour,
  };

  return (
    <TourContext.Provider value={contextValue}>
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        run={run}
        scrollToFirstStep
        showProgress
        showSkipButton
        stepIndex={stepIndex}
        steps={tourSteps}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 10000,
            arrowColor: '#fff',
            backgroundColor: '#fff',
            textColor: '#1f2937',
          },
          tooltip: {
            fontSize: 14,
            padding: 20,
          },
          buttonNext: {
            backgroundColor: '#2563eb',
            fontSize: 14,
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#6b7280',
            fontSize: 14,
            marginRight: 10,
          },
          buttonSkip: {
            color: '#6b7280',
            fontSize: 14,
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Tour',
        }}
      />
      {children}
    </TourContext.Provider>
  );
}
