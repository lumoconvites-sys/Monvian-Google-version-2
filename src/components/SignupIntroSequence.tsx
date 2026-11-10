import React from 'react';

export type SignupIntroStage = 'idle' | 'white' | 'video' | 'revealing';

interface SignupIntroSequenceProps {
  stage: SignupIntroStage;
  onAdvanceStage: (nextStage: SignupIntroStage) => void;
}

export const SignupIntroSequence: React.FC<SignupIntroSequenceProps> = () => {
  return null;
};
