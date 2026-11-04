import assert from 'node:assert/strict'
import { DEFAULT_PRIVACY_POLICY_URL, cleanHttpsUrl, env } from '@/config/env'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  await t('the app links to E5\'s published policy unless told otherwise, the same address as in Google Play Console', () => {
    assert.equal(DEFAULT_PRIVACY_POLICY_URL, 'https://e5energyng.com/privacy-policy/')
    assert.equal(env.privacyPolicyUrl, DEFAULT_PRIVACY_POLICY_URL)
  })
  await t('a setting is taken as a secure address, with the quotes and spaces of a pasted value removed', () => {
    assert.equal(cleanHttpsUrl('https://example.com/privacy'), 'https://example.com/privacy')
    assert.equal(cleanHttpsUrl('  https://example.com/privacy/  '), 'https://example.com/privacy/')
    assert.equal(cleanHttpsUrl('"https://example.com/p?lang=en#top"'), 'https://example.com/p?lang=en#top')
    assert.equal(cleanHttpsUrl("'HTTPS://EXAMPLE.COM/privacy'"), "HTTPS://EXAMPLE.COM/privacy")
  })
  await t('anything that is not a plain secure web address is not used, so a typo can never send people somewhere strange', () => {
    for (const bad of [undefined, '', '   ', 'http://example.com/privacy', 'example.com/privacy', 'https://', 'https:///privacy', 'https://exa mple.com', 'javascript:alert(1)', 'ftp://example.com', 'mailto:a@b.com', 'data:text/html,hi']) {
      assert.equal(cleanHttpsUrl(bad), undefined, String(bad))
    }
  })
}
main().then(report)
