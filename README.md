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
| under 600 dp | a phone | one pane, bottom bar of five (Dashboard, Monitoring, Live Map, Alarms, More); Track, Group call, Admins and Wi-Fi are in More |
| 600-839 dp | 8-10" tablet, portrait | one pane, the side rail with every module, content capped at 720 dp |
| 840 dp and up | 8-10" tablet, landscape | the side rail; list and detail side by side |

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

### Navigation

On a tablet (600 dp and up, in portrait or landscape) the main navigation is a **side rail** down the left edge, like the web's
sidebar, with every module the account may use, in the web's order: Dashboard, Monitoring, Live Map, Track, Group call, Alarms,
Admins, Wi-Fi, then More (fences, alerts, account, about). Each account sees only what it can use. A narrow screen has no room
for nine, so it gets a bottom bar of five and the four extra modules are reached from More, with a way back.

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

- **Site Wi-Fi** (the **Wi-Fi** module in the side rail; More > Site Wi-Fi on a narrow screen). The network every helmet is told to join; each helmet gets it in its
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

## Group call

The **Group call** module in the side rail (More > Group call on a narrow screen; needs `groupCall:read`). Choose a group and helmets, **record a voice message on the tablet**, listen back,
and send it to every chosen helmet, with a result per helmet (played, queued for when it reconnects, not sent). Live group
calls (video) are not in the app. In a real build the screen stays hidden until voice messages are switched on, because the
upload request is unchecked: what is known, what is guessed and how to switch it on are in [docs/GROUP_CALL.md](docs/GROUP_CALL.md).

## Voice messages with one helmet

On any helmet: **Voice messages** (needs `groupCall:read`). A conversation like the web's: what was sent to the helmet on the
right, recordings from the wearer on the left, each with a player (one plays at a time). Before a recording is played its link
is checked, because the links expire after about an hour; a dead one is reported as "no longer available" instead of playing
silence. The list refreshes every few seconds while it is open. Reading works in a real build. **Sending** (record, listen
back, send, then "Delivered" or "Queued" for an offline helmet) is off in a real build until
`EXPO_PUBLIC_BROADCAST_ENABLED=true`, for the same reason as group messages: the web sends MP3 and a tablet can only record
`.m4a`, which the backend must be willing to convert ([docs/GROUP_CALL.md](docs/GROUP_CALL.md)).

## Administrators

The **Admins** module in the side rail (More > Administrators on a narrow screen; needs `ADMINISTRATOR_SETTING`; viewing needs only read). Built from the web's users module, with
its permission file copied verbatim so a role shows the same screens on a tablet as in the browser.

- **Accounts:** list with search, add, edit, delete. A password left blank on an edit is never sent, so it can't be wiped.
- **Permissions:** a tree where each area is View, or View plus *Can change* (only one code is ever stored). You can
  only tick what you hold yourself, as the backend insists; *Select all* gives the strongest right you may grant.
- **Helmets:** an account can be limited to chosen helmets; the last one can't be unticked (that would silently mean
  every helmet).
- **Delete** follows the backend's rules (Cypher, 20 Oct): not your own account, only a super admin deletes a super
  admin, never the last super admin. Deleting signs that account out on its next request and removes its tablets'
  push registrations. It is also how a lost tablet is cut off, since there is no logout or revoke endpoint.
- **Groups:** add, rename, delete, with a count of who is in each.
- Sample accounts: `AD-001` administers but is not a super admin (so the grant limits and locked super-admin rows
  can be seen); `ADM-001` is the super admin.

## Branding and orientation

The look follows the web dashboard (colours, Inter / Epilogue / Geist Mono, the dot-grid canvas and the
"Command Centre" sign-in panel), and the app is locked to **portrait**. What is where, and how to swap in the
real company logo (the one in the app is an interim crop): [docs/BRANDING.md](docs/BRANDING.md).

## Alarm alerts for a locked tablet (push)

The app hears alarms over a live connection that stops when the screen locks, so a locked tablet misses an SOS.
Push fixes that. The backend side is built (Cypher, 20 Oct, going live with his next deploy) and the app side is built and
tested; it stays **off** (`EXPO_PUBLIC_PUSH_ENABLED=false`) until E5's Expo, Firebase and FCM-key set-up exists. While off, More > Alarm
alerts says so plainly. Full setup and turn-on steps: [docs/PUSH_SETUP.md](docs/PUSH_SETUP.md).

- Two Android channels, `sos` (siren, alarm volume, can pass Do Not Disturb) and `alarm`. The ids are a contract
  with the backend.
- The backend sends through Expo's push service, so the app registers an **Expo push token** with
  `PUT /api/push/registrations/{installId}`; signing out unregisters it. (Expo is a third party in the path.)
- Gas alarms at danger level are critical on the backend: the app never hides their notification, since on its own it
  would only chime.
- Notifications are never requested out of the blue: a banner and the More screen offer "Turn on alerts".
- Tapping an alert opens that alarm; while the app is open and its alarm connection is live the system
  notification is suppressed, and shown again if the connection drops.
- "Send a test alert" works without the backend, to check the siren on a locked tablet.
- Permissions follow the web: `fences`, `live` and `groups` are capabilities (no tab), as in the web's `modules.ts`.

## Live view and calls with a helmet

On a helmet: **Watch live**, **Call helmet**, and **Join SOS call** (also in the SOS banner and on an SOS alarm). Built on the
web's own live module, so it uses the same protocol: the helmet's picture and sound over WebRTC from the media server, and
voice back from the tablet (no camera, no camera permission). Who may: watching needs live view, calling needs live
management, and anyone signed in can join an SOS. A call ends, and the helmet leaves call mode, when you hang up, leave the
screen, or stay out of the app for more than a few seconds. **Not yet tried on a real helmet**, so a real build keeps it
hidden until `EXPO_PUBLIC_LIVE_ENABLED=true`: what to try and what can't be known from here are in [docs/CALLS.md](docs/CALLS.md).

## Fences

Built from the web app's own fence module (types, geometry and validation are the same code).

- **On the Live Map.** Saved fences draw under the helmets: work areas in teal, no-entry zones in amber,
  grey when switched off. A "Fences" chip toggles them. On a tablet the side panel has Helmets and Fences
  tabs; on a phone, tapping a fence opens a card, and "Fence list" opens the full list.
- **Drawing.** Tap the map to place a circle's centre or add polygon corners; drag the circle's handle or a
  numbered corner to adjust. Radius is typed or stepped by 50 m. The same rules as the web: a name is
  required, a polygon needs 3 corners, a fence under 50 m across warns about GPS false alarms, active hours
  may cross midnight, and "chosen helmets" can't be unticked down to none (that would silently mean everyone).
  The backend's own 400 messages are shown as written.
- **Permissions.** A `fences` module, as the web's fence screens use: `FENCE` views, `FENCE_MANAGE` changes.
- **Warning clip.** Attach an MP3 or WAV (up to 5 MB) from the tablet, replace it, remove it, and preview it
  before saving, or **record one on the tablet** (up to 30 seconds; the backend converts the .m4a to MP3 for the
  helmet). If the fence saves but the clip upload fails, the fence is kept and only the clip is retried (saving
  again edits it, it can't create a duplicate).

## Track playback

Built from the web app's track-playback module; the rules in `lib/track.ts` and `lib/availability.ts` are
the web code, with the changes below.

- **Screen.** The **Track** module in the side rail (More > Track playback on a narrow screen), or "Replay route" on any helmet (which opens its last 7 days at once).
  Pick a helmet and a period (quick ranges, or two YYYY-MM-DD dates), then View: six figures, an uptime
  chart, the route with A/B markers and a moving marker, play/pause, point-by-point stepping, 1x to 64x
  speeds, and a scrubber. Export hands over a CSV (a download in the browser, the share sheet on a tablet).
- **Rules kept from the web.** Under 3 m between fixes counts as no movement; a silence over 5 minutes
  starts a new segment and adds no distance; a leg faster than 40 m/s is rejected as an impossible fix.
- **Changed from the web.** Positions from the mobile network or Wi-Fi are left out by default (Cypher's
  16 Oct update added the fix type, and those can be hundreds of metres off, which inflates distance); a
  switch brings them back. Dates use the tablet's local day, where the web page used UTC (a day off for the
  first hour after midnight in Lagos). The map fits every run of real length, not only the longest, and keeps
  the route clear of the playback bar.
- **Long ranges.** The telemetry endpoint takes `from` and `to` (and pages of up to 10,000 rows). The app reads up to
  three pages, newest first; a range too big for that is trimmed at its oldest end and says so.

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
