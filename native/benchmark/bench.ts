import { Bench } from 'tinybench'

import { calculateKpiGrowth } from '../index.js'

function jsCalculateKpiGrowth(current: number, previous: number) {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

const b = new Bench()

b.add('Native calculateKpiGrowth', () => {
  calculateKpiGrowth(120, 100)
})

b.add('JavaScript calculateKpiGrowth', () => {
  jsCalculateKpiGrowth(120, 100)
})

await b.run()

console.table(b.table())
