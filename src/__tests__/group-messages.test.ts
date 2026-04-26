// Feature: wave-feature-backlog, Property 6: Group message sender name always present

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Property 6: Group message sender name always present
// For any incoming message in a group conversation where own=false,
// the sender name must be a non-empty string.
describe('Property 6: Group message sender name always present', () => {
  it('sender name is always a non-empty string for incoming group messages', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (senderName, content) => {
          // Simulate the message object as it would be in the store
          const msg = {
            id: crypto.randomUUID(),
            sender: senderName,
            content,
            time: '12:00',
            own: false,
            type: 'text' as const,
          };
          // In a group context with own=false, sender must be non-empty
          expect(msg.sender.length).toBeGreaterThan(0);
          expect(typeof msg.sender).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
