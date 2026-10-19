# E5 Smart Helmet — mobile

React Native (Expo SDK 58) companion to the E5 Smart Helmet Dashboard. Same
backend, same data model, same permission strings as the web app.

**Stack:** Expo · Expo Router · NativeWind 4 (Tailwind 3) · TanStack Query ·
Zustand · Axios · TypeScript (strict)

## Run it

```bash
npm install
cp .env.example .env        # then edit
npx expo start              # press a / i, or scan with Expo Go
```

Set `EXPO_PUBLIC_USE_MOCKS=true` to run on sample data with no backend.
Mock sign-ins: `ADM-001` (super admin), `OP-014` (read-only: no Dashboard, can't
resolve alarms), `RO-001` (can view settings, not change them), `MFA-001` (two-step; code `123456`). Any password works. In
sample-data mode the **More** tab has buttons that fire a fake SOS, fall or
helmet-removed alarm through the same path a real one takes.

Expo Go is expected to work for now. Calls and live video (WebRTC) will need a
development build: `npx expo run:android` / `run:ios`, or
`eas build --profile development`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Strict type-check of the app and the tests |
| `npm test` | Logic tests: sign-in, roles, 401/403 handling, the alarm stream client, alarms, footage, alert policy, tablet layout rules |
| `npm run doctor` | `expo-doctor` dependency check |
| `npm run apk` | Builds the installable APK in the cloud (see *Building the APK*) |

## Layout

```
src/app/            Routes (Expo Router). Tabs, helmet/[id], security, sign-in
src/modules/        auth, devices, alarms — API clients, hooks, mocks, types
                    alarms/lib: the stream client and the alert policy
src/shared/         components, lib (token, api-client, session…), store, constants
tests/              Logic tests (run with `npm test`)
```

## Tablet layout

The app targets Android tablets of 8 inches and up, held in the hand, in both orientations.
Layout follows the *window* width in dp (`shared/lib/layout.ts`), so turning the tablet or
using split-screen changes it live:

| Width | Typical device | Layout |
| --- | --- | --- |
| under 600 dp | a phone | one pane, bottom tabs |
| 600-839 dp | 8-10" tablet, portrait | one pane, bottom tabs, content capped at 720 dp |
| 840 dp and up | 8-10" tablet, landscape | slim side rail; list and detail side by side |

- **List and detail.** On a wide screen, Alarms and Monitoring show the list on the left and
  the chosen item on the right. The detail screens (`AlarmDetailView`, `HelmetDetailView`)
  are the same components whether they fill a screen or sit in a pane.
- **Nothing is selected by default.** Opening an alarm acknowledges it, which silences its
  siren, so auto-selecting the first alarm would silence the most urgent one unasked.
- **`openAlarm` / `openHelmet`** work from anywhere (banner, toast, dashboard). They use the
  pane on a wide screen, and a full screen otherwise, or whenever the account lacks that tab.
- **Checking it without a tablet.** Run the sample-data web preview and resize the browser to
  960 x 600 and 1280 x 800 (landscape) and 600 x 960 and 800 x 1280 (portrait). dp and CSS
  pixels are the same unit there.

## Live Map

Helmets are drawn on a map, coloured by status (green online, amber degraded, grey offline).
A helmet with an unresolved alarm is ringed (pulsing red if critical), and each unresolved alarm
that has a position gets a teardrop pin hovering just above it. A position that came from the mobile
network or Wi-Fi, not GPS, gets a dashed circle showing how far out it could be. A helmet that has
never reported a position isn't drawn; the map says how many are missing.

- **How it works.** The map is Leaflet, embedded in the app (`leaflet.generated.ts`, so there's no
  CDN), shown in a WebView on a tablet and in an iframe in the browser preview. It is the same page in
  both, so checking it in the browser checks what the tablet runs. After changing the Leaflet version
  run `npm run map:assets`.
- **Tiles.** The default is OpenStreetMap's public server, which is only meant for light use and
  isn't suitable for a fleet in daily use. For production set `EXPO_PUBLIC_MAP_TILE_URL` and
  `EXPO_PUBLIC_MAP_ATTRIBUTION` to a provider E5 has an account with.
- **Layout.** Landscape tablets get the map with a helmet panel on the right; portrait tablets and
  phones get the full map with a card over it.
- **Not built yet.** Fences (drawing and managing them) and track playback. Both need endpoints
  and types from the web app.

## Site Wi-Fi and helmet settings

Built from Cypher's 16 Oct backend update.

- **Site Wi-Fi** (More > Site Wi-Fi). The network every helmet is told to join; each helmet gets it in its
  start-up settings. The password is never returned by the backend, so editing with an empty password
  keeps the current one. Saving with no password on a network that has none asks first (an open network).
- **Connection** (on a helmet). Switch one helmet between Wi-Fi and mobile data. Both directions are
  confirmed, because a helmet switched to a SIM with no data stays offline until it can reach Wi-Fi again.
  If the backend reports no SIM (409 `no_sim`) a second, stronger confirmation is needed to force it.
- **Video recording** (on a helmet). Splitting on or off, and clip length (10, 20 or 30 minutes; the
  backend accepts any whole minute from 1 to 60). Settings reach the helmet straight away but apply when
  it restarts, and the backend's "apply" only makes it reconnect, so there is deliberately no apply button.
  Once settings are saved for a helmet its spoken alarm prompts follow them (on by default).
- **Permissions.** Viewing needs `UNIT_SETTING`, changing needs `UNIT_SETTING_MANAGE`. The backend hasn't
  said which permission the two network-switch endpoints need; the app assumes the same as changing the
  Wi-Fi, and shows "Your role isn't allowed to do that" if it turns out to be different.
- **Not built.** The rest of a helmet's Unit Setting (upload method, picture quality, temperatures,
  hat-off and no-movement times, alarm sounds). The backend sends them, but their field names aren't documented.

## How alarms work

- **Stream.** `GET /alarms/stream` (Server-Sent Events) is read with `fetch` while
  the app is in the foreground. It reconnects with `Last-Event-ID`, survives the
  server's 30-minute close, and notices silent stalls. Polling slows to every
  2 minutes while the stream is up and returns to 10 seconds if it drops.
- **Critical alarms** (SOS, SOS button, fall, near electricity, no movement) put
  a red banner on every screen and sound a looping siren with vibration, until
  silenced, opened, or resolved. **Silence** is per phone; the banner stays until
  the alarm is resolved. The alert window is 30 minutes, matching the backend's
  rule for joining an SOS call. Everything about this lives in
  `modules/alarms/lib/alert-policy.ts`.
- **Other alarms** get one chime and a toast.
- **Footage** comes from `GET /alarms/{id}`. The screen re-checks every 30 seconds
  while clips are still uploading.
- **Background:** a phone that is locked or in another app is not reached by any
  of this. That needs push notifications (FCM/APNs) and backend support.

## Conventions worth knowing

- **Fonts.** React Native can't use font stacks or `font-bold` with custom
  fonts; each weight is its own family. Use `font-sans`, `font-sans-medium`,
  `font-sans-semibold`, `font-sans-bold`, `font-display-bold`,
  `font-display-extrabold`, `font-mono`. Use the `Text` component in
  `shared/components`, which applies the defaults.
- **Permissions.** The profile comes from `GET /auth/me`. The backend's flat codes
  are translated to `module:action` in `shared/constants/backend-permissions.ts`;
  screens use `useCan()` / `RequirePermission`. These only decide what is
  *shown*: the server enforces. A 403 with `{"error":"forbidden"}` is a
  permission refusal and never signs the user out; a 401, or a 403 without that
  body, means the token is dead.
- **Token storage.** The bearer token lives in the device keychain
  (`expo-secure-store`) and is mirrored in memory so request interceptors stay
  synchronous. `tokenStore.load()` runs once at launch.
- **Polling.** The backend socket belongs to the helmets, so lists poll every
  10 seconds. Polling pauses when the app is backgrounded.
- **Shared with the web app.** `api-normalize.ts`, `modules/alarms/types.ts`
  and `modules/devices/lib/presence.ts` are copied from the web repo. Keep
  them in step: a fix in one needs making in the other.
  `backend-permissions.ts` was written from the backend's code list, not copied:
  diff it against the web's `expandPermissions()`.

## Before shipping

- Replace the placeholder icons in `assets/` and the "E5" text mark in
  `shared/components/Logo.tsx` with the real logo.
- Set the real bundle identifier / package name in `app.json`
  (currently `com.e5energy.smarthelmet`).
- Replace the placeholder siren and chime in `assets/sounds` with the client's tones.
- The audio plugin is configured with no microphone, no recording and no
  background playback on purpose. Keep it that way unless the app starts recording.

## Building the APK

The app ships as an APK, a single file installed directly on Android tablets, with no
app store involved. Expo builds it in the cloud.

```bash
npm install -g eas-cli
eas login                      # an Expo account; ideally E5's
eas init                       # once: links the project and writes its id into app.json
npm run apk                    # eas build --platform android --profile preview
```

When the build finishes, EAS gives a download link and a QR code for the `.apk`. Open
it on a tablet and allow "install unknown apps" for the browser when Android asks.
Play Protect may warn the first time.

- **Signing key.** EAS creates and stores it on the first build. Every future update must
  use the same key, or each tablet has to uninstall first. Back it up
  (`eas credentials`) and keep it in E5's name.
- **Version numbers.** `autoIncrement` in `eas.json` raises `versionCode` on every
  build, so a tablet accepts the new file as an update.
- **Two profiles.** `preview` produces an installable link for testing; `production`
  produces the same kind of APK without the internal-distribution page.
- **Native code.** Calls and live video (WebRTC) will need native modules and a new APK
  installed again; small JavaScript fixes can go over the air once `expo-updates` is set up.
