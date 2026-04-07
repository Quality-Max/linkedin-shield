/**
 * Known extensions data validation
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse the JS file to extract data
const src = readFileSync(resolve(__dirname, '../known-extensions.js'), 'utf8');

// Extract KNOWN_EXTENSIONS object entries
const extMatches = [...src.matchAll(/^\s*([a-z0-9]+):\s*\{\s*name:\s*'([^']+)',\s*category:\s*'([^']+)'\s*\}/gm)];

describe('Known Extensions — Data Integrity', () => {
  it('has extension entries defined', () => {
    expect(extMatches.length).toBeGreaterThan(20);
  });

  it('all extension IDs are lowercase alphabetic (Chrome format)', () => {
    for (const m of extMatches) {
      expect(m[1]).toMatch(/^[a-z]{32,33}$/);
    }
  });

  it('all extension IDs are unique', () => {
    const ids = extMatches.map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all extensions have non-empty names', () => {
    for (const m of extMatches) {
      expect(m[2].length).toBeGreaterThan(0);
    }
  });

  it('all extensions have non-empty categories', () => {
    for (const m of extMatches) {
      expect(m[3].length).toBeGreaterThan(0);
    }
  });

  it('has CATEGORY_RISKS defined', () => {
    expect(src).toContain('CATEGORY_RISKS');
  });

  it('all extension categories appear in CATEGORY_RISKS', () => {
    const categories = [...new Set(extMatches.map((m) => m[3]))];
    for (const cat of categories) {
      // Category keys may be quoted ('Ad Blocker':) or unquoted (Privacy:)
      const quoted = src.includes(`'${cat}':`);
      const unquoted = src.includes(`${cat}:`);
      expect(quoted || unquoted).toBe(true);
    }
  });
});
