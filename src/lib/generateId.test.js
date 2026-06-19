import { describe, expect, it } from 'vitest';
import {
  buildSequentialCodes,
  getNextSequentialNumber,
  isUniqueConstraintError,
} from './generateIdCore';

describe('generateId helpers', () => {
  it('calculates the next sequential number from the last code', () => {
    expect(getNextSequentialNumber(null)).toBe(1);
    expect(getNextSequentialNumber('CP2606-0007')).toBe(8);
    expect(getNextSequentialNumber('CP2606-bad')).toBe(1);
  });

  it('builds padded sequential codes', () => {
    expect(buildSequentialCodes('TC2606-', 9, 3)).toEqual([
      'TC2606-0009',
      'TC2606-0010',
      'TC2606-0011',
    ]);
  });

  it('detects Prisma unique constraint errors', () => {
    expect(isUniqueConstraintError({ code: 'P2002' })).toBe(true);
    expect(isUniqueConstraintError({ code: 'P2003' })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
