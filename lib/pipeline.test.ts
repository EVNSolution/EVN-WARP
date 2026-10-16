import assert from 'node:assert/strict'
import test from 'node:test'

import configuredChecks from '@/data/pipeline-checklists.json'
import { getProcess } from './pipeline'

test('B2C lead stages expose only the approved transition gates and retain supporting work', () => {
  const immature = getProcess('1-1')!
  const potential = getProcess('1-2')!
  const mature = getProcess('1-3')!

  assert.deepEqual(immature.checks.filter(check => check.role === 'required').map(check => check.key), ['1-1-call'])
  assert.equal(immature.checks.find(check => check.key === '1-1-0')?.role, 'reference')
  assert.deepEqual(potential.checks.filter(check => check.role === 'required').map(check => check.key), ['1-2-2', '1-2-4', '1-2-quote'])
  assert.deepEqual(mature.checks.filter(check => check.role === 'required').map(check => check.key), ['1-3-confirmed'])

  assert.equal(mature.checks.find(check => check.key === '1-3-1')?.role, 'confirmation')
  assert.equal(mature.checks.find(check => check.key === '1-3-2')?.role, 'history')
  for (const key of ['1-3-5', '1-3-6', '2-1-0']) {
    assert.equal(mature.checks.find(check => check.key === key)?.role, 'transaction')
  }
  for (const key of ['1-3-0', '1-3-4', '1-3-4b', '1-3-7']) {
    assert.equal(mature.checks.find(check => check.key === key)?.role, 'reference')
  }
})

test('B2C deposit wording is isolated from B2B and bundled config retains unrelated keys', () => {
  const sale = getProcess('2-1')!
  assert.deepEqual(sale.checks[0], {
    key: '2-1-1', label: 'B2C 10만원 계약금 입금·실제 입금일 확인', role: 'firstTask',
  })
  assert.equal(sale.checksB2B?.[0].label, 'EV& 계약금 납입')

  for (const code of ['1-1', '1-2', '1-3', '2-1'] as const) {
    const configured = configuredChecks[code]
    const defined = getProcess(code)!.checks
    assert.deepEqual(configured.map(check => check.key), defined.map(check => check.key))
    for (const check of defined) {
      assert.equal(configured.find(item => item.key === check.key)?.role, check.role)
    }
  }
  assert.deepEqual(Object.keys(configuredChecks).slice(-2), ['4-1', '4-2'])
})
