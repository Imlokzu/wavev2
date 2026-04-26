// Feature: wave-feature-backlog, Property 11: Settings boolean toggle persistence
// Feature: wave-feature-backlog, Property 12: Settings enum selection persistence

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase
let lastUpsertPayload: any = null;
vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: (payload: any) => {
        lastUpsertPayload = payload;
        return Promise.resolve({ error: null });
      },
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

import { useSettings } from '@/store/settings-store';

beforeEach(() => {
  lastUpsertPayload = null;
  // Reset store to defaults
  useSettings.setState({
    notificationsEnabled: true,
    soundEnabled: true,
    showLastSeen: true,
    showReadReceipts: true,
    language: 'English',
    bio: '',
    fontSize: 'normal',
    profileVisibility: 'everyone',
    loading: false,
    loaded: false,
  });
});

// Property 11: Settings boolean toggle persistence
describe('Property 11: Settings boolean toggle persistence', () => {
  it('store value equals input value after save for boolean settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.constantFrom('notificationsEnabled', 'soundEnabled', 'showReadReceipts', 'showLastSeen'),
        async (value, key) => {
          const settings = useSettings.getState();
          await settings.save('test-user-id', { [key]: value });
          const updated = useSettings.getState();
          expect((updated as any)[key]).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 12: Settings enum selection persistence
describe('Property 12: Settings enum selection persistence', () => {
  it('store value equals selected value after save for enum settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('compact', 'normal', 'large'),
        async (fontSize) => {
          const settings = useSettings.getState();
          await settings.save('test-user-id', { fontSize: fontSize as any });
          const updated = useSettings.getState();
          expect(updated.fontSize).toBe(fontSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('store value equals selected value after save for profileVisibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('everyone', 'contacts'),
        async (profileVisibility) => {
          const settings = useSettings.getState();
          await settings.save('test-user-id', { profileVisibility: profileVisibility as any });
          const updated = useSettings.getState();
          expect(updated.profileVisibility).toBe(profileVisibility);
        }
      ),
      { numRuns: 100 }
    );
  });
});
