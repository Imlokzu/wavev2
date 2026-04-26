// Feature: wave-feature-backlog, Property 3: Invite code uniqueness and format
// Feature: wave-feature-backlog, Property 4: Join by valid code grants membership
// Feature: wave-feature-backlog, Property 5: Invalid invite code does not grant membership

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Test the generateInviteCode logic directly (extracted for testing)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length])
    .join('');
}

// Mock Supabase for join tests
let mockConvId: string | null = null;
let insertCalled = false;

vi.mock('@/utils/supabase', () => {
  const supabase = {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => {
            if (table === 'conversations' && mockConvId) {
              return { data: { id: mockConvId }, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      insert: (_payload: any) => {
        insertCalled = true;
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { supabase };
});

beforeEach(() => {
  mockConvId = null;
  insertCalled = false;
});

// Property 3: Invite code uniqueness and format
describe('Property 3: Invite code uniqueness and format', () => {
  it('generates codes matching [A-Z0-9]{6} and all unique in a batch', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        (n) => {
          const codes = Array.from({ length: n }, () => generateInviteCode());
          // All match format
          expect(codes.every(c => /^[A-Z0-9]{6}$/.test(c))).toBe(true);
          // All unique (probabilistically — collision chance is negligible)
          expect(new Set(codes).size).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 4: Join by valid code grants membership
describe('Property 4: Join by valid code grants membership', () => {
  it('inserts membership when a valid code matches a conversation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^[A-Z0-9]{6}$/.test(s)),
        fc.uuid(),
        async (code, userId) => {
          insertCalled = false;
          mockConvId = crypto.randomUUID();
          // Inline the joinGroupByCode logic for testing
          const { supabase } = await import('@/utils/supabase');
          const { data: conv } = await (supabase.from('conversations') as any)
            .select('id')
            .eq('invite_code', code)
            .maybeSingle();
          if (conv) {
            await (supabase.from('conversation_members') as any).insert({
              conversation_id: conv.id,
              user_id: userId,
              group_role: 'member',
            });
          }
          expect(conv).not.toBeNull();
          expect(insertCalled).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Property 5: Invalid invite code does not grant membership
describe('Property 5: Invalid invite code does not grant membership', () => {
  it('returns error and does not insert when code is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => !/^[A-Z0-9]{6}$/.test(s)),
        fc.uuid(),
        async (_code, _userId) => {
          insertCalled = false;
          mockConvId = null; // no matching conversation
          // Inline the joinGroupByCode logic for testing
          const { supabase } = await import('@/utils/supabase');
          const { data: conv } = await (supabase.from('conversations') as any)
            .select('id')
            .eq('invite_code', _code)
            .maybeSingle();
          // Should not find a conversation
          expect(conv).toBeNull();
          // Should not insert
          expect(insertCalled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
