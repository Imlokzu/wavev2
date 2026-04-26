// Feature: wave-feature-backlog, Property 1: Session deduplication by fingerprint
// Feature: wave-feature-backlog, Property 2: Session registration idempotence

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Supabase mock
// We intercept @/utils/supabase so registerSession never hits the network.
// The mock is built as a chainable builder that resolves at the terminal call.
// ---------------------------------------------------------------------------

// Shared state the tests can mutate per-scenario
let mockExistingSession: { id: string } | null = null;
let mockInsertId: string | null = null;
let mockUpdateError: { message: string } | null = null;
let insertCallCount = 0;
let updateCallCount = 0;

function makeChain(terminal: () => Promise<any>): any {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined; // not a thenable itself
        // terminal methods
        if (prop === "maybeSingle") return terminal;
        if (prop === "single") return terminal;
        // passthrough for chaining
        return () => chain;
      },
    }
  );
  return chain;
}

vi.mock("@/utils/supabase", () => {
  const channelMock = {
    on: () => channelMock,
    subscribe: () => channelMock,
  };

  const supabase = {
    channel: () => channelMock,
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: (table: string) => ({
      // DELETE chain — always resolves successfully (stale session cleanup)
      delete: () => ({
        eq: () => ({
          lt: () => Promise.resolve({ error: null }),
          neq: () => Promise.resolve({ error: null }),
        }),
      }),
      // SELECT chain — returns existing session or null
      select: (cols: string) => ({
        eq: (_col1: string, _val1: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => {
              if (table === "sessions" && cols === "id") {
                return { data: mockExistingSession, error: null };
              }
              return { data: null, error: null };
            },
          }),
          order: () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: mockExistingSession, error: null }),
        }),
      }),
      // UPDATE chain
      update: (_payload: any) => ({
        eq: (_col: string, _val: string) => {
          updateCallCount++;
          return Promise.resolve({ error: mockUpdateError });
        },
      }),
      // INSERT chain
      insert: (_payload: any) => ({
        select: (_cols: string) => ({
          maybeSingle: async () => {
            insertCallCount++;
            if (mockInsertId) {
              return { data: { id: mockInsertId }, error: null };
            }
            return { data: null, error: { message: "insert failed" } };
          },
        }),
      }),
    }),
  };

  return { supabase };
});

// ---------------------------------------------------------------------------
// Import AFTER mock is set up
// ---------------------------------------------------------------------------
import { registerSession, clearSession } from "@/utils/sessions";

// ---------------------------------------------------------------------------
// Reset module state between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  clearSession();
  mockExistingSession = null;
  mockInsertId = null;
  mockUpdateError = null;
  insertCallCount = 0;
  updateCallCount = 0;
});

// ---------------------------------------------------------------------------
// Property 1: Session deduplication by fingerprint
//
// When registerSession is called and a session with the same (userId, fingerprint)
// already exists, the existing session's last_active is updated and no new row
// is inserted.
// ---------------------------------------------------------------------------
describe("Property 1: Session deduplication by fingerprint", () => {
  it("updates last_active and returns existing id when fingerprint matches", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (userId, existingId) => {
          // Reset state for each iteration
          clearSession();
          insertCallCount = 0;
          updateCallCount = 0;

          // Simulate an existing session row with the same fingerprint
          mockExistingSession = { id: existingId };
          mockInsertId = null;

          const result = await registerSession(userId);

          // Should return the existing session id
          expect(result).toBe(existingId);
          // Should have updated last_active, not inserted a new row
          expect(updateCallCount).toBeGreaterThanOrEqual(1);
          expect(insertCallCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Session registration idempotence
//
// Calling registerSession while a currentSessionId is already set returns the
// same session ID without creating a duplicate (the registering/currentSessionId
// guard fires on the second call).
// ---------------------------------------------------------------------------
describe("Property 2: Session registration idempotence", () => {
  it("returns the same session ID on repeated calls and does not insert twice", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        // Reset state for each iteration
        clearSession();
        insertCallCount = 0;
        updateCallCount = 0;

        // First call: no existing session → insert a new row
        mockExistingSession = null;
        const newId = crypto.randomUUID();
        mockInsertId = newId;

        const firstResult = await registerSession(userId);
        expect(firstResult).toBe(newId);

        const insertAfterFirst = insertCallCount;

        // Second call: currentSessionId is now set → guard fires, returns same id
        const secondResult = await registerSession(userId);
        expect(secondResult).toBe(newId);

        // No additional inserts on the second call
        expect(insertCallCount).toBe(insertAfterFirst);
      }),
      { numRuns: 100 }
    );
  });
});
