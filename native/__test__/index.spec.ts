import test from 'ava'

import { calculateKpiGrowth } from '../index'

test('calculateKpiGrowth computes percent growth', (t) => {
  t.is(calculateKpiGrowth(100, 50), 100)
})

test('calculateKpiGrowth returns 0 when previous is 0', (t) => {
  t.is(calculateKpiGrowth(100, 0), 0)
})
