/**
 * Declarative net request rules tests — validate rules.json structure
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rules = JSON.parse(readFileSync(resolve(__dirname, '../rules.json'), 'utf8'));

describe('Rules — Structure Validation', () => {
  it('has rules defined', () => {
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('all rules have unique IDs', () => {
    const ids = rules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all rules have required fields', () => {
    for (const rule of rules) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('action');
      expect(rule).toHaveProperty('condition');
      expect(typeof rule.id).toBe('number');
    }
  });

  it('all rules use block action', () => {
    for (const rule of rules) {
      expect(rule.action.type).toBe('block');
    }
  });

  it('rules target LinkedIn-related domains', () => {
    const targetDomains = rules.flatMap((r) => r.condition.initiatorDomains || r.condition.requestDomains || []);
    const hasLinkedIn = targetDomains.some((d) => d.includes('linkedin'));
    expect(hasLinkedIn).toBe(true);
  });
});

describe('Rules — Surveillance Endpoints', () => {
  it('blocks sensorCollect endpoint', () => {
    const sensorRule = rules.find(
      (r) => r.condition.urlFilter?.includes('sensorCollect') || r.condition.regexFilter?.includes('sensorCollect'),
    );
    expect(sensorRule).toBeDefined();
  });

  it('blocks protechts.net (HUMAN Security)', () => {
    const protechtsRule = rules.find(
      (r) =>
        r.condition.urlFilter?.includes('protechts') ||
        r.condition.requestDomains?.some((d) => d.includes('protechts')),
    );
    expect(protechtsRule).toBeDefined();
  });
});

describe('Rules — Manifest Consistency', () => {
  it('manifest references rules.json', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8'));
    expect(manifest.declarative_net_request).toBeDefined();
    const ruleResources = manifest.declarative_net_request.rule_resources;
    expect(ruleResources).toBeDefined();
    const linkedinRule = ruleResources.find((r) => r.path === 'rules.json');
    expect(linkedinRule).toBeDefined();
    expect(linkedinRule.enabled).toBe(true);
  });
});
