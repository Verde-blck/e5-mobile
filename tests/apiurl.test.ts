import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { env, resolveApiBaseUrl } from '@/config/env'
import { connectAlarmStream } from '@/modules/alarms/lib/alarmStream'
import { joinUrl } from '@/shared/lib/url'
import { createRunner } from './harness'

const { t, report } = createRunner()
const release = { release: true, useMocks: false }
const dev = { release: false, useMocks: false }
const sample = { release: true, useMocks: true }

async function main() {
  await t('a release build with no server address says so, and does not fall back to the production server', () => {
    const r = resolveApiBaseUrl(undefined, release)
    assert.equal(r.url, ''); assert.match(r.problem ?? '', /no server address/); assert.match(r.problem ?? '', /EXPO_PUBLIC_API_BASE_URL/)
  })
  await t('an empty, blank or quotes-only address counts as missing, not as an address', () => {
    for (const raw of ['', '   ', '""', "''", ' "" ', '/', '///']) {
      const r = resolveApiBaseUrl(raw, release)
      assert.equal(r.url, '', JSON.stringify(raw)); assert.match(r.problem ?? '', /no server address/, JSON.stringify(raw))
    }
  })
  await t('a developer build with no address is refused too: there is no fallback to the production server in any build', () => {
    for (const raw of [undefined, '', '  ', '""']) {
      const r = resolveApiBaseUrl(raw, dev)
      assert.equal(r.url, '', JSON.stringify(raw)); assert.match(r.problem ?? '', /no server address/, JSON.stringify(raw))
    }
  })
  await t('trailing slashes, spaces and quotes are removed, so the address is always joined onto cleanly', () => {
    for (const raw of ['https://h.example/api', 'https://h.example/api/', 'https://h.example/api///', '  https://h.example/api/  ', '"https://h.example/api/"', " 'https://h.example/api/' "]) {
      assert.deepEqual(resolveApiBaseUrl(raw, release), { url: 'https://h.example/api', problem: null }, JSON.stringify(raw))
    }
  })
  await t('a release build accepts only a full https address, and says what is wrong with anything else', () => {
    for (const raw of ['e5energy.up.railway.app/api', 'http://h.example/api', 'ftp://h.example', 'https://', 'https:///api', 'https://h example/api', 'javascript:alert(1)', 'https://h.example/api?x=1', 'https://h.example/api#top']) {
      const r = resolveApiBaseUrl(raw, release)
      assert.match(r.problem ?? '', /is not valid/, raw); assert.match(r.problem ?? '', /starts with https:\/\//, raw)
    }
  })
  await t('a developer build also accepts plain http, for a server on the same network', () => {
    assert.deepEqual(resolveApiBaseUrl('http://10.0.2.2:3000/api/', dev), { url: 'http://10.0.2.2:3000/api', problem: null })
    assert.match(resolveApiBaseUrl('http://10.0.2.2:3000/api', release).problem ?? '', /is not valid/)
    assert.match(resolveApiBaseUrl('ftp://h.example', dev).problem ?? '', /http:\/\/ or https:\/\//)
  })
  await t('a sample-data build never contacts a server, so it has nothing to complain about whatever it is given', () => {
    for (const raw of [undefined, '', 'nonsense', 'http://x']) assert.equal(resolveApiBaseUrl(raw, sample).problem, null, String(raw))
  })
  await t('the message names the bad address, shortened when it is very long', () => {
    assert.match(resolveApiBaseUrl('nope', release).problem ?? '', /"nope"/)
    const long = resolveApiBaseUrl('x'.repeat(200), release).problem ?? ''
    assert.ok(long.length < 260 && long.includes('...'), long)
  })

  await t('a path is joined onto an address with exactly one slash, whichever slashes either already has', () => {
    for (const base of ['https://h.example/api', 'https://h.example/api/', 'https://h.example/api//']) {
      for (const path of ['alarms/stream', '/alarms/stream', '//alarms/stream']) {
        const url = joinUrl(base, path)
        assert.equal(url, 'https://h.example/api/alarms/stream', `${base} + ${path}`)
        assert.ok(!url.replace('https://', '').includes('//'), url)
      }
    }
    assert.equal(joinUrl('https://h.example/api/', '/x?a=1&b=2'), 'https://h.example/api/x?a=1&b=2', 'a query string is kept')
  })
  await t('the alarm stream asks for /alarms/stream under the address, with no doubled slash', async () => {
    assert.ok(!env.apiBaseUrl.endsWith('/'), 'the address is stored without a trailing slash')
    let asked = ''
    const stream = connectAlarmStream({
      fetchImpl: (input) => { asked = String(input); return Promise.reject(new Error('stop here')) },
      getToken: () => 'token', onStatus: () => {}, onUnauthorized: () => {}, onAlarm: () => {}, onUpdate: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 30)); stream.stop()
    assert.equal(asked, `${env.apiBaseUrl}/alarms/stream`); assert.ok(!asked.replace('https://', '').includes('//'), asked)
  })

  await t('every build profile sets a valid server address itself, because no build has a default', () => {
    const eas = JSON.parse(readFileSync(resolve(process.cwd(), 'eas.json'), 'utf8')).build as Record<string, { extends?: string; env?: Record<string, string> }>
    const effective = (name: string): Record<string, string> => ({ ...(eas[name].extends ? effective(eas[name].extends as string) : {}), ...(eas[name].env ?? {}) })
    for (const name of Object.keys(eas)) {
      const raw = effective(name).EXPO_PUBLIC_API_BASE_URL
      assert.ok(raw, `${name} sets EXPO_PUBLIC_API_BASE_URL`)
      assert.deepEqual(resolveApiBaseUrl(raw, release), { url: raw.replace(/\/+$/, ''), problem: null }, `${name} has a valid address`)
    }
    assert.equal(eas.production.env?.EXPO_PUBLIC_API_BASE_URL, 'https://e5energy-production.up.railway.app/api', 'production keeps pointing where it always has')
  })
}
main().then(report)
