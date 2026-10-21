import assert from 'node:assert/strict'
import { parseFlag } from '@/config/env'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  await t('a switch is read the way people write it: True, TRUE, 1, yes, on, with spaces or quotes; anything else, or nothing, is off', () => {
    for (const on of ['true', 'True', 'TRUE', ' true ', '1', 'yes', 'on', '"true"', "'true'", ' "True" ']) assert.equal(parseFlag(on), true, JSON.stringify(on))
    for (const off of ['false', 'False', '0', 'no', 'off', '', ' ', 'tru', 'truee', 'enabled', undefined]) assert.equal(parseFlag(off), false, JSON.stringify(off))
  })
}
main().then(report)
