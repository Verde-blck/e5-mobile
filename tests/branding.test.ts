import assert from 'node:assert/strict'
import { fetchBranding, toProfile } from '@/modules/branding/api/branding.api'
import { DEFAULT_BRAND, brandFor, brandVariables, surfaceColours, contrastWithWhite, hueAndSaturation, looksLikeAlarm, mix, normaliseColour, primaryProblem } from '@/modules/branding/lib/colour'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()

async function main() {
  await t('colours are read the way the backend does: with or without #, three digits or six, any case, and always returned as #RRGGBB', () => {
    assert.deepEqual(['0b5cad', '#0b5cad', '#0bc', '0BC', ' #f28c28 '].map(normaliseColour), ['#0B5CAD', '#0B5CAD', '#00BBCC', '#00BBCC', '#F28C28'])
    for (const bad of ['', '#', 'blue', '#12', '#12345', '#1234567', '#GGGGGG', 'rgb(1,2,3)']) assert.equal(normaliseColour(bad), null, bad)
  })
  await t('mixing and contrast do what they say', () => {
    assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080'); assert.equal(mix('#102030', '#FFFFFF', 0), '#102030'); assert.equal(mix('#102030', '#FFFFFF', 1), '#FFFFFF')
    assert.ok(Math.abs(contrastWithWhite('#000000') - 21) < 0.01); assert.ok(Math.abs(contrastWithWhite('#FFFFFF') - 1) < 0.01); assert.ok(contrastWithWhite(DEFAULT_BRAND.primary) > 6, 'E5 teal is comfortably readable')
  })
  await t('red, orange and amber are recognised as the alarm colours; teal, blue and grey are not', () => {
    for (const alarm of ['#DC2626', '#F28C28', '#F59E0B', '#B91C1C', '#FF4500']) assert.equal(looksLikeAlarm(alarm), true, alarm)
    for (const fine of ['#0A6659', '#0B5CAD', '#6D28D9', '#475569', '#808080', '#111111']) assert.equal(looksLikeAlarm(fine), false, fine)
    assert.deepEqual(hueAndSaturation('#808080'), { hue: 0, saturation: 0 })
  })
  await t('a primary colour is used only if white text can be read on it and it is not an alarm colour; E5\'s own orange is neither', () => {
    assert.equal(primaryProblem('#0B5CAD'), null); assert.equal(primaryProblem(null), null); assert.equal(primaryProblem(undefined), null)
    assert.equal(primaryProblem('#F28C28'), 'unreadable', 'orange: too light for white text'); assert.equal(primaryProblem('#FFFF00'), 'unreadable'); assert.equal(primaryProblem('#B91C1C'), 'alarm-like', 'a dark red is readable, but it is the alarm colour')
  })
  await t('no company colour, or one that can\'t be used, gives exactly the E5 look; a good one gives a full, matching set', () => {
    for (const none of [null, undefined, '', 'not a colour', '#F28C28', '#B91C1C', DEFAULT_BRAND.primary]) assert.deepEqual(brandFor(none), DEFAULT_BRAND, String(none))
    const blue = brandFor('#0b5cad'); assert.equal(blue.primary, '#0B5CAD'); assert.ok(contrastWithWhite(blue.secondary) > contrastWithWhite(blue.primary), 'the dark shade is darker')
    assert.ok(contrastWithWhite(blue.tint) < 1.3 && contrastWithWhite(blue.soft) < 2, 'tint and soft are pale'); assert.equal(new Set(Object.values(blue)).size, 5, 'five different colours')
    assert.deepEqual(brandVariables(DEFAULT_BRAND), { '--brand-primary': '#0A6659', '--brand-secondary': '#0C352F', '--brand-tint': '#E6F2F0', '--brand-soft': '#B9DAD4', '--brand-mint': '#A3E2D7' })
  })

  await t('the drawn surfaces (the sign-in panel, the helmet mark) are exactly E5\'s own with no company colour, and follow a company\'s otherwise', () => {
    assert.deepEqual(surfaceColours(DEFAULT_BRAND), { mint: '#A7E5DA', deep: '#0C352F', panel: '#0B342E', glow: '#0F4F46' }, 'unchanged: pixel for pixel what it was')
    assert.deepEqual(surfaceColours(brandFor('#F28C28')), surfaceColours(DEFAULT_BRAND), 'a refused colour leaves them alone too')
    const blue = surfaceColours(brandFor('#0B5CAD')); assert.notDeepEqual(blue, surfaceColours(DEFAULT_BRAND)); assert.equal(blue.panel, brandFor('#0B5CAD').secondary); assert.equal(blue.mint, brandFor('#0B5CAD').mint)
  })

  await t('the profile is read safely: unset fields are null, colours are normalised, and a blank name is not a name', () => {
    assert.deepEqual(toProfile({ companyName: 'E5 Energy', supportEmail: ' a@b.co ', logoUrl: 'https://r2/x.png', primaryColor: '0b5cad', secondaryColor: null, updatedAt: '2026-10-21T08:15:00Z' }), { companyName: 'E5 Energy', supportEmail: 'a@b.co', logoUrl: 'https://r2/x.png', primaryColor: '#0B5CAD', secondaryColor: null, updatedAt: '2026-10-21T08:15:00Z' })
    assert.deepEqual(toProfile({ companyName: '  ', primaryColor: 'junk' }).companyName, null); assert.equal(toProfile({ primaryColor: 'junk' }).primaryColor, null); assert.equal(toProfile(null).companyName, null)
  })
  await t('branding is fetched from the public endpoint, so it works before anyone signs in, and a missing one never breaks the app', async () => {
    http.calls.length = 0
    http.routes = { 'GET /branding': () => ({ status: 200, data: { companyName: 'E5 Energy', primaryColor: '#0b5cad', logoUrl: 'https://r2/x.png' } }) }
    const b = await fetchBranding(); assert.deepEqual([b.companyName, b.primaryColor, b.logoUrl], ['E5 Energy', '#0B5CAD', 'https://r2/x.png']); assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['GET /branding'])
    http.routes = { 'GET /branding': () => ({ status: 404 }) }; await assert.rejects(fetchBranding(), 'a server without it is an error, which the app answers by staying on the E5 look')
  })
}
main().then(report)
