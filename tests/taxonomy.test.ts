import test from 'node:test';
import assert from 'node:assert/strict';
import { patterns, pattern, familyMembers, validateSeverity, revisionPasses, causeFamilies } from '../extensions/llgf/taxonomy.ts';

test('all 56 source distinctions map onto 48 nonempty families', () => {
  assert.equal(patterns.length, 56); assert.equal(new Set(patterns.map(p => p.id)).size, 56);
  assert.equal(new Set(patterns.map(p => p.family)).size, 48);
  assert.deepEqual(familyMembers('E6').map(p => p.id), ['E7', 'E8']);
  assert.deepEqual(familyMembers('H6').map(p => p.id), ['H6', 'H7', 'H8']);
  assert.equal(pattern('e8').title, 'Focalization leakage');
  assert.throws(() => pattern('E9'), /Unknown/);
});
test('severity systems remain separate and missing is not zero', () => {
  validateSeverity('chapter5-0-4', 4); validateSeverity('appendixB-0-3', null);
  for (const bad of [4, -1, 1.5, NaN, Infinity]) assert.throws(() => validateSeverity('appendixB-0-3', bad));
});
test('revision vocabulary and independent source cause families are preserved', () => {
  assert.equal(revisionPasses.length, 11);
  assert.equal(causeFamilies.chapter5.length, 8); assert.equal(causeFamilies.appendixB.length, 8);
  assert.notEqual(causeFamilies.chapter5[0], causeFamilies.appendixB[0]);
});
