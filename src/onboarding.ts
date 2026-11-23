import { ProjectOnboarding } from './model';
export const onboardingSteps = ['welcome', 'ai-choice', 'target-language', 'privacy', 'offline-demo', 'finish'] as const;
export function nextOnboarding(state: ProjectOnboarding): ProjectOnboarding { const step = Math.min(state.lastStep + 1, onboardingSteps.length - 1); return { ...state, lastStep: step, completed: step === onboardingSteps.length - 1, skipped: false }; }
export function previousOnboarding(state: ProjectOnboarding): ProjectOnboarding { return { ...state, lastStep: Math.max(0, state.lastStep - 1), completed: false }; }
export function skipOnboarding(state: ProjectOnboarding): ProjectOnboarding { return { ...state, skipped: true, completed: false }; }
export function restartOnboarding(): ProjectOnboarding { return { completed: false, skipped: false, lastStep: 0 }; }
