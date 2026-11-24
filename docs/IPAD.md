# The iPad version (Apple App Store)

**Status.** The app-side code is built and tested in the browser and by logic tests. **Nothing has been built for, or run on, an iPad yet.**
Three things have to happen first: E5 has an Apple Developer account, E5 decides how the app is shared, and (for alerts on a locked iPad)
Cypher's backend accepts iPads. See `E5-iPad-App-Store-requirements.pdf` and `E5-iPad-APIs-and-services.pdf` for what each person owes.

## What is in the app now

| Part | What it does | Where |
| --- | --- | --- |
| iPad only | `ios.supportsTablet` and `ios.isTabletOnly` are true, so the Xcode project targets iPad only (`TARGETED_DEVICE_FAMILY = 2`). An iPhone cannot install it. | `app.json` |
| Rotation | Expo gives an iPad all four orientations, which Apple requires. So an **iPad rotates, while Android stays locked to portrait**. The layouts follow the window width, so landscape shows list and detail side by side. To keep an iPad in portrait, set `ios.requireFullScreen`, which also turns off split view. | `app.json`, `src/shared/lib/layout.ts` |
| Microphone and camera wording | One honest sentence each. The two microphone plugins must say the same thing, because both write the same Info.plist key (a test checks this). | `app.json` |
| Time Sensitive capability | Lets an alarm break through Focus modes. EAS switches the capability on in E5's Apple account by itself. It still follows the silent switch. | `ios.entitlements` |
| Apple Maps | An iPad gets Apple Maps: free, no key. If it fails while drawing, the OpenStreetMap map takes over. `EXPO_PUBLIC_MAP_ENGINE=osm` forces OpenStreetMap. | `src/modules/map` (`MapSurface.ios.tsx`, `NativeMapSurface.tsx`) |
| Long siren | `assets/sounds/sos-long.wav`, 25 seconds. Apple plays a notification sound once and allows up to 30 seconds. A separate file, so the Android siren is unchanged. | `assets/sounds`, `IOS_SIREN_SOUND` |
| Push for iPad | Registers with `platform: "ios"`, asks for alert and sound permission (no badge), and has no Android channels or battery shortcut. **Off until the switch below is set.** | `src/modules/push` |

## The switch

`EXPO_PUBLIC_PUSH_IOS_ENABLED` is separate from `EXPO_PUBLIC_PUSH_ENABLED`, which stays for Android. While it is off, an iPad says
"Alerts while locked: not on yet. Until they are, keep this app open with the screen on to hear alarms", and sends nothing to the backend.
That is alert option A in the requirements document, and it needs no backend change.

## Turning on alerts for iPad (option B)

1. E5 has the Apple account, and the Apple push key is in E5's Expo account. EAS can create it during the first iOS build.
2. Cypher has made the backend changes in `E5-iPad-APIs-and-services.pdf`: accept `platform: "ios"`, and send iPad alerts with `sound: "sos-long.wav"`,
   `interruptionLevel: "time-sensitive"` and `priority: "high"`.
3. Set `EXPO_PUBLIC_PUSH_IOS_ENABLED=true` for the production build (an EAS variable or the profile's `env`), and build again.
4. On the iPad: More, then Alarm alerts, then **Turn on alerts**. Press **Send a test alert**, lock the iPad, and check the siren and the lock screen.
5. Repeat with a Focus mode on and with the silent switch on. Then raise a real alarm from a helmet.

## Building (once the Apple account exists)

```
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

The first upload creates the app in App Store Connect, and Apple needs a company name for that, so `submit.production.ios` in `eas.json` sets `companyName`, `appName`, `sku` and `language`. Without `companyName` the first upload fails with "You must provide a value for the attribute 'companyName'". EAS asks for the Apple account sign-in (or an App Store Connect API key), creates the certificates and provisioning itself, and synchronises the
capabilities. Test through TestFlight on a real iPad before submitting for review. `eas.json` already sets the server address for every profile.

## A test build that also installs on iPhone

TestFlight refuses an iPad-only build on an iPhone ("can only be tested on an iPad"). To try the app on an iPhone before an iPad is available, there is a
separate profile, `ios-testflight-iphone`. It is the `production` profile plus one setting, `E5_IOS_TABLET_ONLY=false`, which `app.config.js` turns into
`isTabletOnly: false`. Anything other than an explicit false (a typo, an empty value) keeps the app iPad only, and a test checks that only this one
profile sets it.

```
npx eas-cli build --platform ios --profile ios-testflight-iphone
npx eas-cli submit --platform ios --latest
```

An iPhone gets the compact layout (a bottom tab bar), portrait only. The phone block on the first screen applies to Android only. This build is for
TestFlight testing, so **never submit it for App Store review**: the first build sent to Apple for review must come from the `production` profile, which is iPad only.
It tests function (sign-in, calls with a real camera and microphone, the siren, permission prompts), not the iPad layout.

## Found on the first iPhone run (24 and 25 November)

**1. The Verify and sign in button was invisible on the iPhone** (an iPhone number keypad has no Go key, so a code could not be sent). The first guess, the
combined inner and outer `boxShadow`, was not the cause. `AuthButton` is now a `TouchableOpacity` with one static style and a border, not a `Pressable` with a
style function, and it **drew correctly on the iPhone** in the next test. The iPhone-safe shadow (`src/modules/auth/lib/shadow.ts`) stays.

**2. Every code was refused**, although the website accepted the same account, with `401 challenge_expired`. **The cause: the app never sent the
challenge.** When 2FA is on, `POST /auth/login` replies `{ requires2fa, username, challenge }` (the `challenge` is a signed value, good for five minutes and one
successful sign-in), and the code step must send `{ challenge, code }`. The app looked for fields called `mfaToken` and `challengeToken`, which the backend never
used, so it sent only the username and the code, and the server answered "no challenge" with `challenge_expired`. The old field names had come from an early
guess before the backend existed, and the first tests were written to match the guess. The contract is in `docs/backend/E5_2FA_Sign-in_API.pdf` (from Cypher).
Now:

- the login reply's `challenge` is kept and sent back as `{ challenge, code }`, with no username (`src/modules/auth/api/auth.api.ts`);
- each error in the backend's list gets its own message (`codeRefusal`, `src/modules/auth/lib/code.ts`): `challenge_expired` (starts a new sign-in silently, because the password is still held), `Invalid or expired code` (the same challenge still works, so just retry, and check the phone's date and time), `code_already_used` (wait for the next code), and `too_many_attempts` (wait 15 minutes, for codes and for passwords);
- an unlisted refusal still shows its status and reason as a reference for support;
- one request is sent at a time, and the code is sent by itself on the sixth digit.

Earlier guesses were removed once the document arrived: a silent sign-in before every code, and asking for cookies. The backend uses neither (no cookies, no extra headers).
Tested in a browser against a pretend server that follows the document, including every listed error. **Not yet confirmed against the real server from an iPhone.**

**3. Testing without a build.** The fastest way to try JavaScript changes on the iPhone is Expo Go (`npx expo start`, then scan the code). It cannot run
`react-native-webrtc`, so live view and calls fail there with "tried to access a native module that doesn't exist": that red error is expected in Expo Go and means
nothing for the real build. Calls, push alerts and the config plugins need the TestFlight build.

## No iPad to hand? Use Expo's remote iPad simulator

Expo Simulators runs an iOS Simulator on an Expo-hosted Mac and shows it in a browser, so it works from Windows. It uses a **simulator build**, which is
unsigned and needs no Apple account. Two profiles in `eas.json`:

- `ios-simulator-sample`: sample data, no sign-in. Good for layout, rotation, Apple Maps and the alarm box (More has buttons that fire sample alarms).
- `ios-simulator`: the real backend. Sign in with a real account.

```
npx eas-cli build --platform ios --profile ios-simulator-sample
```

Then on expo.dev open the project's **Simulator sessions**, choose **New simulator**, platform iOS, controller Agent Device, build source **Latest app build**,
and an iPad device. Stop the session when finished. A simulator has no camera or microphone, so calls cannot be tried, it cannot receive push alerts, and it
is slower than a real iPad. It does not replace a test on a real iPad through TestFlight.

## Not checked

- Anything on a real iPad: Apple Maps, rotation, live video, calls, alerts and the siren.
- That `aps-environment` is `production` in the store build. The local project shows `development`, and the provisioning profile should decide it. Confirm on TestFlight.
- Vibration: an iPad cannot vibrate, so alarms are the siren and the red box only.
- Whether Apple grants Critical Alerts (option C).
