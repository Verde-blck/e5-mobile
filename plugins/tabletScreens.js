// Keep in step with TABLET_MIN_DP in src/shared/lib/tabletGate.ts (a test checks it).
const MIN_WIDTH_DP = 600

// Declares the app as tablet-only so Google Play can keep phones from offering or installing it.
function setSupportsScreens(manifest) {
  manifest.manifest['supports-screens'] = [
    {
      $: {
        'android:smallScreens': 'false',
        'android:normalScreens': 'false',
        'android:largeScreens': 'true',
        'android:xlargeScreens': 'true',
        'android:requiresSmallestWidthDp': String(MIN_WIDTH_DP),
      },
    },
  ]
  return manifest
}

module.exports = { MIN_WIDTH_DP, setSupportsScreens }
