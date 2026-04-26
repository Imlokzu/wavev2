// Feature: wave-feature-backlog, Property 8: Password validation correctness

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePassword } from '@/utils/validation';

describe('Property 8: Password validation correctness', () => {
  it('returns valid=true iff all four requirements are met', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (s) => {
          const result = validatePassword(s);
          const shouldBeValid =
            s.length >= 8 &&
            /[A-Z]/.test(s) &&
            /[0-9]/.test(s) &&
            /[^A-Za-z0-9]/.test(s);

          expect(result.valid).toBe(shouldBeValid);

          if (!result.valid) {
            expect(typeof result.error).toBe('string');
            expect((result.error ?? '').length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
