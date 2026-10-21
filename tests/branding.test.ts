import assert from 'node:assert/strict'
import { fetchBranding, fetchCompany, removeLogo, saveCompany, toProfile, uploadLogo } from '@/modules/branding/api/branding.api'
import { DEFAULT_BRAND, brandFor, brandVariables, surfaceColours, contrastWithWhite, hueAndSaturation, looksLikeAlarm, mix, normaliseColour, primaryProblem } from '@/modules/branding/lib/colour'
import { describeCompanyError, logoProblem, validateCompany } from '@/modules/branding/lib/validate'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()

async function main() {
  // =============== colours ===============
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

  // =============== the form ===============
  await t('the form is checked against the backend\'s rules first: name up to 80, email if given, colours as #RRGGBB; empty is fine', () => {
    const ok = { companyName: 'E5 Energy', supportEmail: 'support@e5energyng.com', primaryColor: '#0B5CAD', secondaryColor: 'f28c28' }
    assert.deepEqual(validateCompany(ok), {}); assert.deepEqual(validateCompany({ companyName: '', supportEmail: '', primaryColor: '', secondaryColor: '' }), {})
    assert.match(validateCompany({ ...ok, companyName: 'x'.repeat(81) }).companyName ?? '', /up to 80/); assert.equal(validateCompany({ ...ok, companyName: 'x'.repeat(80) }).companyName, undefined)
    assert.match(validateCompany({ ...ok, supportEmail: 'nope' }).supportEmail ?? '', /email/); assert.match(validateCompany({ ...ok, primaryColor: 'blue' }).primaryColor ?? '', /#0B5CAD/); assert.match(validateCompany({ ...ok, secondaryColor: '12' }).secondaryColor ?? '', /colour/)
  })
  await t('a logo is checked for type, size and dimensions before it is sent: PNG, JPEG or WebP, 512 KB, 1024 px a side', () => {
    const png = { mimeType: 'image/png', name: 'logo.png', size: 1000, width: 400, height: 200 }
    assert.equal(logoProblem(png), null); assert.equal(logoProblem({ ...png, mimeType: 'image/webp' }), null); assert.equal(logoProblem({ ...png, mimeType: '', name: 'logo.JPG' }), null, 'a picker that gives no type: by name')
    assert.match(logoProblem({ ...png, mimeType: 'image/gif', name: 'a.gif' }) ?? '', /PNG, JPEG or WebP/); assert.match(logoProblem({ ...png, mimeType: 'application/pdf', name: 'a.pdf' }) ?? '', /PNG, JPEG or WebP/)
    assert.equal(logoProblem({ ...png, size: 512 * 1024 }), null, 'exactly 512 KB is allowed'); assert.match(logoProblem({ ...png, size: 512 * 1024 + 1 }) ?? '', /512 KB/)
    assert.equal(logoProblem({ ...png, width: 1024, height: 1024 }), null); assert.match(logoProblem({ ...png, width: 1200, height: 800 }) ?? '', /1024 px.*1200 x 800/)
  })
  await t('the server\'s refusals say which field they are about, in the server\'s own words', () => {
    const e = (status: number, data?: unknown) => ({ response: { status, data } })
    assert.deepEqual(describeCompanyError(e(400, { error: 'invalid_logo', message: 'logo must be at most 1024 px on each side (this one is 1200 x 800)' })), { field: 'logo', message: 'logo must be at most 1024 px on each side (this one is 1200 x 800)' })
    assert.equal(describeCompanyError(e(400, { error: 'invalid_primaryColor', message: 'x' })).field, 'primaryColor'); assert.equal(describeCompanyError(e(400, { error: 'invalid_companyName', message: 'x' })).field, 'companyName'); assert.equal(describeCompanyError(e(400, { error: 'invalid_supportEmail', message: 'x' })).field, 'supportEmail')
    assert.match(describeCompanyError(e(403)).message, /isn't allowed/); assert.match(describeCompanyError(e(401)).message, /Sign in again/); assert.match(describeCompanyError(e(500)).message, /connection is fine/); assert.match(describeCompanyError({}).message, /Check the connection/)
  })

  // =============== the requests ===============
  await t('the profile is read safely: unset fields are null, colours are normalised, and a blank name is not a name', () => {
    assert.deepEqual(toProfile({ companyName: 'E5 Energy', supportEmail: ' a@b.co ', logoUrl: 'https://r2/x.png', primaryColor: '0b5cad', secondaryColor: null, updatedAt: '2026-10-21T08:15:00Z' }), { companyName: 'E5 Energy', supportEmail: 'a@b.co', logoUrl: 'https://r2/x.png', primaryColor: '#0B5CAD', secondaryColor: null, updatedAt: '2026-10-21T08:15:00Z' })
    assert.deepEqual(toProfile({ companyName: '  ', primaryColor: 'junk' }).companyName, null); assert.equal(toProfile({ primaryColor: 'junk' }).primaryColor, null); assert.equal(toProfile(null).companyName, null)
  })
  await t('branding is fetched without needing a sign-in (public); the signed-in copy and the save use the settings paths, with only the fields changed', async () => {
    http.calls.length = 0
    http.routes = { 'GET /branding': () => ({ status: 200, data: { companyName: 'E5 Energy', primaryColor: '#0B5CAD' } }), 'GET /settings/company': () => ({ status: 200, data: { companyName: 'E5 Energy' } }), 'PUT /settings/company': (c) => ({ status: 200, data: { ...(c.data as object), updatedAt: 'now' } }) }
    assert.equal((await fetchBranding()).primaryColor, '#0B5CAD'); assert.equal((await fetchCompany()).companyName, 'E5 Energy')
    const saved = await saveCompany({ companyName: 'E5 Energy', secondaryColor: '' }); assert.deepEqual(http.calls.at(-1)!.data, { companyName: 'E5 Energy', secondaryColor: '' }, '"" is sent as is: it clears the field'); assert.equal(saved.companyName, 'E5 Energy')
    assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['GET /branding', 'GET /settings/company', 'PUT /settings/company'])
  })
  await t('a logo goes up as a multipart `file`, and comes off with a DELETE; both answer with the profile', async () => {
    http.calls.length = 0
    http.routes = { 'POST /settings/company/logo': () => ({ status: 200, data: { logoUrl: 'https://r2/new.png' } }), 'DELETE /settings/company/logo': () => ({ status: 200, data: { logoUrl: null } }) }
    const up = await uploadLogo({ uri: 'file:///logo.png', name: 'logo.png', mimeType: 'image/png', file: new Blob([new Uint8Array(100)], { type: 'image/png' }) })
    const form = http.calls[0].data as FormData; assert.deepEqual([...form.keys()], ['file']); assert.equal((form.get('file') as File).name, 'logo.png'); assert.match(http.calls[0].contentType ?? '', /multipart\/form-data/); assert.equal(up.logoUrl, 'https://r2/new.png')
    assert.equal((await removeLogo()).logoUrl, null); assert.equal(`${http.calls[1].method} ${http.calls[1].url}`, 'DELETE /settings/company/logo')
  })
  await t('a refused save or logo is an error carrying the server\'s answer, so nothing is shown as saved', async () => {
    http.routes = { 'PUT /settings/company': () => ({ status: 400, data: { error: 'invalid_primaryColor', message: 'primaryColor must look like #RRGGBB' } }), 'POST /settings/company/logo': () => ({ status: 400, data: { error: 'invalid_logo', message: 'logo must be at most 1024 px on each side (this one is 1200 x 800)' } }) }
    await assert.rejects(saveCompany({ primaryColor: 'zzz' }), (e: unknown) => describeCompanyError(e).field === 'primaryColor')
    await assert.rejects(uploadLogo({ uri: 'f', name: 'l.png', mimeType: 'image/png', file: new Blob([]) }), (e: unknown) => describeCompanyError(e).message.includes('1200 x 800'))
  })
}
main().then(report)
