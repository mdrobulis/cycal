import { describe, expect, it } from 'vitest';
import { ltCount } from './strings';

describe('ltCount', () => {
  it('uses the singular for 1 and 21', () => {
    expect(ltCount(1, 'įrašas', 'įrašai', 'įrašų')).toBe('1 įrašas');
    expect(ltCount(21, 'įrašas', 'įrašai', 'įrašų')).toBe('21 įrašas');
  });

  it('uses the few form for 2–9 and 22–29', () => {
    expect(ltCount(2, 'įrašas', 'įrašai', 'įrašų')).toBe('2 įrašai');
    expect(ltCount(9, 'įrašas', 'įrašai', 'įrašų')).toBe('9 įrašai');
    expect(ltCount(22, 'įrašas', 'įrašai', 'įrašų')).toBe('22 įrašai');
  });

  it('uses the many form for 0, 10–20 and 111', () => {
    expect(ltCount(0, 'įrašas', 'įrašai', 'įrašų')).toBe('0 įrašų');
    expect(ltCount(10, 'įrašas', 'įrašai', 'įrašų')).toBe('10 įrašų');
    expect(ltCount(11, 'įrašas', 'įrašai', 'įrašų')).toBe('11 įrašų');
    expect(ltCount(111, 'įrašas', 'įrašai', 'įrašų')).toBe('111 įrašų');
  });
});
