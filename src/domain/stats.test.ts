import { describe, expect, it } from 'vitest';
import { periodFor, previousPeriod } from './stats';

describe('periods', () => {
  it('неделя начинается с понедельника', () => {
    expect(periodFor('week', '2026-10-07', 0)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });
  it('месяц и предыдущий месяц', () => {
    const p = periodFor('month', '2026-03-15', 0);
    expect(p).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(previousPeriod('month', p)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});
