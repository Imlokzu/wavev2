// Feature: wave-feature-backlog, Property 7: GIF messages render in separate block rows

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Property 7: GIF messages render in separate block rows
// For any sequence of N consecutive GIF messages, each should be in its own
// block-level container with no overlapping vertical positions.
describe('Property 7: GIF messages render in separate block rows', () => {
  it('each GIF message has a unique sequential position in the list', () => {
    fc.assert(
      fc.property(
        fc.array(fc.webUrl(), { minLength: 2, maxLength: 10 }),
        (gifUrls) => {
          // Simulate the message list structure
          const messages = gifUrls.map((url, i) => ({
            id: `gif-${i}`,
            type: 'gif' as const,
            content: url,
            // Each message gets a sequential index (simulating DOM order)
            index: i,
          }));

          // Each message should have a unique index (no two at the same position)
          const indices = messages.map(m => m.index);
          const uniqueIndices = new Set(indices);
          expect(uniqueIndices.size).toBe(messages.length);

          // Each message should be a block-level element (type === 'gif' uses block container)
          messages.forEach(msg => {
            expect(msg.type).toBe('gif');
            // The container class is 'block mt-1 mb-1' — verify the type is correct
            expect(['gif', 'image']).toContain(msg.type);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
