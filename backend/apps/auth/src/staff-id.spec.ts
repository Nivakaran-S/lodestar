import { nextStaffId, normalizeStaffId, STAFF_ID_PATTERN, staffPrefix } from './staff-id';

describe('staff IDs', () => {
  it('depot prefixes: KDY and PLG for the original depots, the first 3 letters for later ones', () => {
    expect(staffPrefix('KANDY')).toBe('KDY');
    expect(staffPrefix('PELIYAGODA')).toBe('PLG');
    expect(staffPrefix('GALLE')).toBe('GAL');
    expect(staffPrefix('MATARA_2')).toBe('MAT');
  });

  it('pattern and normalisation', () => {
    expect(STAFF_ID_PATTERN.test('KDY-0427')).toBe(true);
    for (const bad of ['KDY0427', 'KDY-427', 'K-0427', 'KDY-04270', 'kdy-0427']) expect(STAFF_ID_PATTERN.test(bad)).toBe(false);
    expect(normalizeStaffId(' kdy-0427 ')).toBe('KDY-0427');
    expect(normalizeStaffId('')).toBeNull();
    expect(normalizeStaffId(null)).toBeNull();
  });

  it('next free: one above the highest of the prefix, the lowest gap when 9999 is taken', () => {
    expect(nextStaffId('KDY', [])).toBe('KDY-0001');
    expect(nextStaffId('KDY', ['KDY-0427', 'KDY-0012', 'PLG-0900', null, 'KDY-x'])).toBe('KDY-0428');
    expect(nextStaffId('KDY', ['KDY-9999', 'KDY-0001'])).toBe('KDY-0002');
  });
});
