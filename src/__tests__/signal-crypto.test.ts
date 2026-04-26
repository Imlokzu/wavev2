// Feature: wave-feature-backlog, Property 10: Key bundle serialization round-trip

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateKeyBundle, serializeBundle, deserializeBundle } from '@/utils/signal-protocol/crypto';

describe('Property 10: Key bundle serialization round-trip', () => {
  it('serialize(deserialize(serialize(b))) === serialize(b)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 16383 }),
        async (registrationId) => {
          const bundle = await generateKeyBundle(registrationId);
          const s1 = serializeBundle(bundle);
          const b2 = deserializeBundle(s1);
          const s2 = serializeBundle(b2);
          expect(s1).toBe(s2);
        }
      ),
      { numRuns: 10 } // crypto operations are slow, 10 is sufficient
    );
  });
});
