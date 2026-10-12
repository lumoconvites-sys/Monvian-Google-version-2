import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Spot } from '../types';
import { TripDateStep } from './itineraries/TripDateStep';
import { PeopleStep } from './itineraries/PeopleStep';
import { BudgetStep } from './itineraries/BudgetStep';
import { TinderDiscoveryStep } from './itineraries/TinderDiscoveryStep';

export interface OnboardingPreferences {
  tripDate: string;
  tripDateFormatted: string;
  adultsCount: number;
  childrenCount: number;
  peopleCount: number;
  budget: string;
  likedSpots: Spot[];
}

interface OnboardingQuestionsModalProps {
  isOpen: boolean;
  spots: Spot[];
  userName?: string;
  onComplete: (preferences: OnboardingPreferences) => void;
  onClose?: () => void;
  theme?: 'dark' | 'light';
}

export const OnboardingQuestionsModal: React.FC<OnboardingQuestionsModalProps> = ({
  isOpen,
  spots,
  onComplete,
  onClose,
  theme = 'dark',
}) => {
  const [wizardStep, setWizardStep] = useState<'date' | 'people' | 'budget' | 'tinder'>('date');
  
  // Accumulated preferences
  const [tripDate, setTripDate] = useState<string>('');
  const [tripDateFormatted, setTripDateFormatted] = useState<string>('');
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [peopleCount, setPeopleCount] = useState<number>(2);
  const [budget, setBudget] = useState<string>('R$ 300 — R$ 600');

  if (!isOpen) return null;

  // Step 1: User selects date
  const handleDateContinue = (isoDate: string, formattedDate: string) => {
    setTripDate(isoDate);
    setTripDateFormatted(formattedDate);
    setWizardStep('people');
  };

  // Step 2: User selects people count
  const handlePeopleContinue = (adults: number, children: number, total: number) => {
    setAdultsCount(adults);
    setChildrenCount(children);
    setPeopleCount(total);
    setWizardStep('budget');
  };

  // Step 3: User selects budget
  const handleBudgetContinue = (budgetValue: string) => {
    setBudget(budgetValue);
    setWizardStep('tinder');
  };

  // Step 4: User finishes Tinder swipe deck -> Only saves preferences (NO itinerary generation)
  const handleTinderFinish = (likedSpots: Spot[]) => {
    const finalPreferences: OnboardingPreferences = {
      tripDate,
      tripDateFormatted,
      adultsCount,
      childrenCount,
      peopleCount,
      budget,
      likedSpots,
    };

    // Save preferences locally
    try {
      localStorage.setItem('monvian_user_preferences', JSON.stringify(finalPreferences));
    } catch (e) {}

    // Complete questionnaire -> triggers Welcome Screen next!
    onComplete(finalPreferences);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[170] flex flex-col justify-between overflow-y-auto bg-black text-white select-none"
      style={{
        paddingTop: 'max(14px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
      }}
    >
      {/* Top Minimalist Header with iOS Pure Dark Style */}
      <div className="w-full max-w-md sm:max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'people') setWizardStep('date');
            else if (wizardStep === 'budget') setWizardStep('people');
            else if (wizardStep === 'tinder') setWizardStep('budget');
            else if (onClose) onClose();
          }}
          className="w-11 h-11 rounded-full ios-glass-btn flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-lg text-white"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Step Pill Indicator */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full ios-glass shadow-md">
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              wizardStep === 'date' ? 'bg-white scale-125' : 'bg-zinc-600'
            }`}
          />
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              wizardStep === 'people' ? 'bg-white scale-125' : 'bg-zinc-600'
            }`}
          />
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              wizardStep === 'budget' ? 'bg-white scale-125' : 'bg-zinc-600'
            }`}
          />
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              wizardStep === 'tinder' ? 'bg-white scale-125' : 'bg-zinc-600'
            }`}
          />
        </div>

        {/* Step Counter */}
        <div className="w-11 flex items-center justify-end">
          <span className="text-[11px] font-black text-zinc-400 tabular-nums px-2.5 py-1 rounded-full ios-glass">
            {wizardStep === 'date' ? '1/4' : wizardStep === 'people' ? '2/4' : wizardStep === 'budget' ? '3/4' : '4/4'}
          </span>
        </div>
      </div>

      {/* Wizard Step Content */}
      <div className="flex-1 w-full overflow-y-auto flex flex-col items-center justify-center px-4 py-2 sm:py-4 my-auto">
        <AnimatePresence mode="wait">
          {wizardStep === 'date' && (
            <TripDateStep
              key="step-date"
              initialDate={tripDate}
              onContinue={handleDateContinue}
              theme="dark"
            />
          )}

          {wizardStep === 'people' && (
            <PeopleStep
              key="step-people"
              initialAdults={adultsCount}
              initialChildren={childrenCount}
              initialCount={peopleCount}
              onContinue={handlePeopleContinue}
              onBack={() => setWizardStep('date')}
              theme="dark"
            />
          )}

          {wizardStep === 'budget' && (
            <BudgetStep
              key="step-budget"
              initialBudget={budget}
              onContinue={handleBudgetContinue}
              onBack={() => setWizardStep('people')}
              theme="dark"
            />
          )}

          {wizardStep === 'tinder' && (
            <TinderDiscoveryStep
              key="step-tinder"
              spots={spots}
              onFinish={handleTinderFinish}
              onBack={() => setWizardStep('budget')}
              theme="dark"
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
