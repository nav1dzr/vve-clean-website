import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWebsiteMediaInventory } from '../src/lib/websiteMediaInventory';

// Filesystem verification belongs in the Node-capable runtime suite, outside
// the browser app's TypeScript programme. Keep the app free of Node typings.
const sources = (item) => item.type === 'photo' ? [item.src]
  : item.type === 'before-after' ? [item.before, item.after] : [item.src, item.poster];

describe('website media inventory files', () => {
  it('points every original photograph, comparison and video at an existing public file', () => {
    const library = { assets: [], topics: [], gallerySlots: [], websiteSlots: [], references: [] };
    const positions = buildWebsiteMediaInventory(library, new Map());
    const localSources = new Set(positions.flatMap(position => sources(position.media)).filter(source => source.startsWith('/')));
    expect(localSources.size).toBeGreaterThan(0);
    for (const source of localSources) {
      expect(existsSync(resolve(process.cwd(), '../public', decodeURIComponent(source.slice(1)))), source).toBe(true);
    }
  });
});
