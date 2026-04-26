// Feature: wave-feature-backlog, Property 9: Signal Protocol encryption round-trip

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase so SignalSession doesn't hit the network
vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

// Mock IndexedDB for KeyStore
const store: Record<string, any> = {};
const mockIDB = {
  open: vi.fn().mockImplementation((_name: string, _version: number) => {
    const req: any = {};
    setTimeout(() => {
      req.result = {
        transaction: (_stores: string[], _mode: string) => ({
          objectStore: (_name: string) => ({
            put: (value: any, key: string) => {
              store[key] = value;
              return { onsuccess: null, onerror: null, set onsuccess(fn: any) { fn?.(); } };
            },
            get: (key: string) => {
              const result = store[key];
              return { result, onsuccess: null, onerror: null, set onsuccess(fn: any) { fn?.(); } };
            },
          }),
          oncomplete: null,
          onerror: null,
        }),
        objectStoreNames: { contains: () => false },
        createObjectStore: vi.fn(),
      };
      req.onupgradeneeded?.({ target: req });
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }),
};

Object.defineProperty(global, 'indexedDB', { value: mockIDB, writable: true });

import { KeyStore } from '@/utils/signal-protocol/KeyStore';
import { SignalSession } from '@/utils/signal-protocol/SignalSession';

describe('Property 9: Signal Protocol encryption round-trip', () => {
  it('decrypt(encrypt(plaintext)) === plaintext for any non-empty string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (plaintext) => {
          const ks = new KeyStore();
          await ks.open();
          const session = new SignalSession(ks, 'test-user-id');

          const encrypted = await session.encrypt(plaintext, 'recipient-id');
          const decrypted = await session.decrypt(encrypted, 'test-user-id');

          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 20 } // crypto operations are slow
    );
  });
});
