import { describe, expect, it } from 'vitest';
import { nextOnboarding, previousOnboarding, restartOnboarding, skipOnboarding } from './onboarding';
describe('onboarding state', () => { it('supports next/back/skip/restart', () => { let state = restartOnboarding(); state = nextOnboarding(state); expect(state.lastStep).toBe(1); state = previousOnboarding(state); expect(state.lastStep).toBe(0); expect(skipOnboarding(state).skipped).toBe(true); expect(restartOnboarding().skipped).toBe(false); }); });
