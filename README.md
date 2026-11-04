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
resolve alarms), `RO-001` (can view settings, not change them), `MFA-001` (two-step; code `123456`), `SETUP-001` (must set up two-step before it can use the app), `NEW-001` (must choose its own password first; typing `wrong` as the current one shows the refusal). Any password works. In
sample-data mode the **More** tab has buttons that fire a fake SOS, fall or
helmet-removed alarm through the same path a real one takes.

Expo Go is expected to work for now. Calls and live video (WebRTC) will need a
development build: `npx expo run:android` / `run:ios`, or
`eas build --profile development`.

## The sign-in screen

The sign-in screen is laid out as the web dashboard's sign-in page (its `AuthLayout.tsx`), so the two look like one product. Every
measurement in `src/app/sign-in.tsx` is that page's, read from it in a browser (about 150 of them, compared at six screen sizes).

| width | layout |
|---|---|
| under 640 | a 224 tall banner; the card overlaps its lower edge by 40 and is as wide as the screen allows; no subtitle in the banner |
| 640 and up | a 256 tall banner, larger title, the subtitle shown, a 400 wide card |
| 1024 and up | two panes: the panel on the left (5 parts of 12), the card centred in the rest (7 parts) |

These are the web page's own widths, not the app's tablet widths (600 and 840), which are for the lists and detail screens. The fields,
button and link are the sign-in screen's own (`modules/auth/components/AuthKit.tsx`); the rest of the app keeps its own.

Like the web page, the button is always there and always full colour. Pressing it with something missing says what ("Enter your username.",
"Enter your password.", "Enter the 6-digit code."), where the app used to grey it out until both fields were filled. Not on the web page,
and kept: the sample-data note under the card (sample-data mode only), and a thin accent line under the logo when the company has set a second colour.

## The sign-in panel's animated network

The dark panel at the top of the sign-in screen carries the web dashboard's animated network: nodes drifting slowly, links that fade in
and out with distance, small packets travelling along live links, and larger "helmet" nodes that pulse. It is the web's `PlexusField`,
ported as it is (`src/shared/brand/plexus.ts`), with the same node counts, speeds and link distances.

A tablet has no browser canvas, so the animation is a small web page: drawn in a transparent web view on the tablet
(`PlexusField.tsx`) and in an iframe in the browser preview (`PlexusField.web.tsx`). Both show exactly the same page, so the preview
is what the tablet draws. The panel behind it (a fine grid, contour lines, a dashed site boundary and a haul road, with a fade into the
panel colour towards the bottom) is the web page's site plan, drawn natively.

- It ignores taps and is hidden from screen readers, and it stops drawing when the panel is off screen.
- If the device asks for reduced motion (Android's "remove animations"), it draws one still frame and nothing moves. The tablet checks
  this before it starts, so someone who asked for no motion never sees any.
- The nodes and links use the company's colour when it has set one (worked out from its main colour), and E5's mint otherwise.
- It exists only on the sign-in screen, so nothing is animating once someone is signed in.

## Tablets only

On an Android screen under 600 dp (every phone) the app shows only "This app is for tablets", with no sign-in and no way past it; nothing
runs behind it. It cannot stop a phone installing the APK, only stop it being used. Turn it off for testing with `EXPO_PUBLIC_TABLET_ONLY=false`.
The rule, its edge cases (foldables, a large Display size) and how to test it: [docs/TABLETS_ONLY.md](docs/TABLETS_ONLY.md).

## Known gaps

- **The alarm sounds are generated tones.** `assets/sounds/sos.wav` and `chime.wav` stand in for E5's own recordings; replace the files and
  nothing else needs to change.

## After unpacking a new zip

Unpacking a zip over the project folder adds and replaces files but never deletes ones that were removed or moved, so old copies pile
up (a screen that moved into the tab bar is left behind in its old place, and the router then sees both). Every zip carries
`zip-manifest.txt`, the list of files that belong. After unpacking, run:

```
npm run prune              shows the leftover files, deletes nothing
npm run prune -- --apply   deletes them
```

It only looks inside `src`, `tests` and `docs`, never touches `node_modules`, `assets`, `.env` or `e5.local.json`, and refuses to run
if the manifest is missing or looks damaged. Then `npm install` and `npx expo start --clear` as usual.

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
| under 600 dp | a phone | one pane, bottom bar of five (Dashboard, Monitoring, Live Map, Alarms, More); Live wall, Track, Group call and Admins are in More |
| 600-839 dp | 8-10" tablet, portrait | one pane, the side rail with every module, content capped at 720 dp |
| 840 dp and up | 8-10" tablet, landscape | the side rail; list and detail side by side |

- **List and detail.** On a wide screen, Alarms and Monitoring show the list on the left and
  the chosen item on the right. The detail screens (`AlarmDetailView`, `HelmetDetailView`)
  are the same components whether they fill a screen or sit in a pane.
- **Nothing is selected by default.** Opening an alarm acknowledges it, which silences its
  siren, so auto-selecting the first alarm would silence the most urgent one unasked.
- **`openAlarm` / `openHelmet`** work from anywhere (the warning banner, the dashboard). They use the
  pane on a wide screen, and a full screen otherwise, or whenever the account lacks that tab.
- **Checking it without a tablet.** Run the sample-data web preview and resize the browser to
  960 x 600 and 1280 x 800 (landscape) and 600 x 960 and 800 x 1280 (portrait). dp and CSS
  pixels are the same unit there.

### Navigation

On a tablet (600 dp and up, in portrait or landscape) the main navigation is a **side rail** down the left edge, like the web's
sidebar, with every module the account may use: Dashboard, Monitoring, Live wall, Live Map, Track, Group call, Alarms, Admins, then
More. Every module in the rail has a back arrow to the initial page (the Dashboard). Each account sees only what it can use. On a
short screen (an 8 inch tablet in landscape is only about 600 dp tall) the rail's items are squeezed so that all of them, More
included, stay on it. A narrow screen has no room for nine, so it gets a bottom bar of five and the extra modules are reached from
More, with a way back.

**Under More** (on every screen size): Fences, Account security, **Site Wi-Fi**, **Photo Record** and **Video Record**. These open as
screens with their own header, and their back arrow returns to More.

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
- **Fences and track playback** are built: see "Fences" and "Track playback" below.

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

## Group call

The **Group call** module in the side rail (More > Group call on a narrow screen) is where helmets are called. Tick the helmets
(up to 8, with a counter, Select all and Clear, as in the web), then **Video call** or **Audio call**.

- **One helmet** is an ordinary one-to-one call (needs live management, `live:write`).
- **Two or more** is a **group call**: every helmet in one room. It needs the group call permission (the backend's `GROUP_CALL`).
  Each helmet has its own tile and its own speaker button (everyone is audible, any one can be muted), your own tile sits beside
  them, and there is one Hang up that ends it for every helmet. Each helmet is its own connection, so one weak signal never
  affects the others, and a helmet that is offline shows "not reachable" and doesn't join later.
- A video call also sends your camera, with a self-view and a camera button; with no camera it carries on as voice.
- If the app is closed or killed mid-call the helmets stay in call mode, so the Group call page offers to **end** that call the next
  time it opens.
- **Beta:** the web dashboard labels it beta and the app keeps the label. See [docs/GROUP_CALL.md](docs/GROUP_CALL.md).

## Voice messages with one helmet

On a helmet's own screen: **Voice messages** (needs `groupCall:read`). A voice message goes to **one helmet**, from that helmet's
screen; there is no sending to several at once. It is a conversation like the web's: what was sent to the helmet on the right,
recordings from the wearer on the left, each with a player (one plays at a time). A link is checked before it is played, because
the links expire after about an hour; a dead one is reported as "no longer available". Sending (record, listen back, send, then
"Delivered" or "Queued" for an offline helmet) needs `groupCall:write`, and no switch. A tablet records `.m4a`, which the backend
now converts to MP3 for the helmet, as it does for fence clips; a browser records WebM, so the preview converts it to the WAV the
web dashboard sends ([docs/GROUP_CALL.md](docs/GROUP_CALL.md)). If a send fails, the message says what the server actually
answered (with its code), and says "check the connection" only when no answer came back.

## Worn and Worn by

The helmet page shows **Worn** as Yes, No, or a dash when it isn't known, and a **Worn by** panel with the worker assigned to that
helmet (name, and staff number and phone if given), or "Unassigned". Assigning, changing and removing a worker needs Monitoring
Center management (`devices:write`). Alarm notifications then name the worker ("SOS: John Ade (ES5 3)"), and the worker's name shows
on the helmet's card in the list.

"Worn" is the backend's `worn` field (true, false, or null for unknown, which is also what an offline helmet gives, so a
disconnected helmet never shows "Yes"). The raw wear code is not read for a helmet: earlier builds treated `1` as worn, but in the
helmet maker's protocol `1` is not worn and `2` is worn, so "Worn" was the wrong way round against the live backend. Telemetry
history rows carry no `worn` field, so those are read by that protocol.

## Privacy policy

Google Play wants the privacy policy reachable inside the app as well as on the store page. The app links to it from the **More**
screen (under About) and from the signed-out screens (sign-in and the new-password screen, which share a layout). The address is E5's,
`https://e5energyng.com/privacy-policy/`, the same one set in Play Console. To use another, set `EXPO_PUBLIC_PRIVACY_POLICY_URL` when
building; only a plain `https://` address is accepted, anything else falls back to E5's. If the tablet has no browser, the address is
shown instead. See `src/shared/lib/privacyPolicy.ts`.

## A temporary password

An account whose password was just issued, or reset by an administrator, has to choose its own before it can use anything. The
backend says so with `mustChangePassword` on `/auth/me`, and, if the reset happens while someone is signed in, by answering other
requests with `403 password_change_required`. Neither is a sign-out. The app shows **Set your own password** (current, new and
confirm; at least 8 characters, matching, and different from the current one) in place of the app, on the same layout as sign-in
(`modules/auth/components/AuthScreen.tsx`), with a **Sign out** link. The alarm stream and push alerts stay off until it is done.
If two-step set-up is also outstanding, the password comes first. The rules are in `modules/auth/lib/password.ts`, the screen is
`app/change-password.tsx`, and a wrong current password, a too-short one or an unreachable server each get their own wording.

## Two-step verification

**Account security** (More) turns two-step verification on or off for your own account. Turning it off needs a current code, and
moving to a **new phone** needs a code from the current one first (the old phone keeps working until the new one is confirmed).

- **Required by the company.** An administrator can switch on **Require two-step verification for everyone** (Administrators). Then
  anyone without it can still sign in, but is taken straight to a set-up screen and can use nothing else until it is done; the
  alarm stream and push alerts stay off until then. Nobody can turn it off while it is required.
- **A refusal is not a sign-out.** While set-up is outstanding the backend answers other requests with `403 2fa_setup_required`.
  The app treats that as "go and set it up", never as an expired session, which would sign the person out in a circle.
- **Lost or changed phone.** An administrator with administrator settings can **Reset 2FA** on an account (Administrators). Not
  your own account, and only a super admin can reset a super admin. The person sets it up again at their next sign-in.

## Company branding

The company profile (name, support email, logo and colours) is edited in the web app; this app only **reads** it, from the public
`GET /api/branding`, which works before anyone signs in. It is fetched while the app starts and on the sign-in screen, so the
company's name, logo and colours show straight away; with no signal, or a backend that doesn't have it yet, the app stays on the E5
look. The logo link expires after an hour, so it is fetched fresh and never stored, and if it can't be loaded the E5 logo is shown
rather than a gap. The company's name and support email also show in About (More).

- **The main colour** colours buttons, the active tab, links, switches, the dot-grid backdrop, and the sign-in panel and helmet mark.
  Everything else (alarm red and amber, status colours) is never themed. The other four shades are worked out from it.
- **Two safeguards**, because this is a safety app: a main colour that white text can't be read on is not applied, and neither is
  one that looks like the alarm colours (red, orange, amber), which must stay the most noticeable things on screen. The app then
  keeps the E5 look.
- **The accent colour** is only a thin line on the sign-in screen. E5's own orange is deliberately not a UI colour.
- With no company colour the app is exactly the E5 look: the five brand colours are variables whose defaults are E5's.
- To check that a backend has it, open `https://<backend>/api/branding` in a browser: it should answer with JSON without signing in.

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

**Watch live** and **Voice messages** are on a helmet's own screen; **Join SOS call** is in the SOS box and on an SOS alarm;
ordinary calls (audio or video) are made from the **Group call** module. Built on the web's own live module, so it uses the same
protocol: the helmet's picture and sound over WebRTC from the media server, and the tablet's microphone (and camera, for a video
call) back. Who may: watching needs live view, calling needs live management, and anyone signed in can join an SOS. A call ends,
and the helmet leaves call mode, when you hang up, leave the screen, or stay out of the app for more than a few seconds. **Not yet
tried on a real helmet**, so a real build keeps it hidden until `EXPO_PUBLIC_LIVE_ENABLED=true`: what to try and what can't be
known from here are in [docs/CALLS.md](docs/CALLS.md).

## Live wall

The **Live wall** module (needs live view, `live:read`): up to six helmets live side by side, like the web's wall. Choose helmets
from the list (a deactivated one can't be added, and a seventh is refused with the reason), and each gets its own tile with its own
connection, so one weak signal never affects the others. Every tile is muted; **enlarge** one to hear it, so only one helmet ever
talks. If the picture arrives but no sound track does (it can take a moment to appear), the enlarged view, and the single helmet's
live screen, say so after three seconds, so a silent stream isn't mistaken for a muted tablet. **Start all** and **Stop all**; removing a tile only closes this tablet's view and never stops the helmet for everyone.
Leaving the wall disconnects from every helmet (they cost the helmets' mobile data, about 0.9 GB an hour each), and coming back
reconnects the same ones; a tablet can't stream from the background, so leaving the app does the same. The web's pop-out window
for a second screen isn't ported: a tablet has no second window. Like the other live features it is hidden in a real build until
`EXPO_PUBLIC_LIVE_ENABLED=true` ([docs/CALLS.md](docs/CALLS.md)).

### If a live module isn't there

The live features (live view, the live wall, calls, group calls, voice messages) are hidden in a real build until their switch is on, and an
account sees one only if it holds the right permission: `SURVEILLANCE` for live view and the wall, `SURVEILLANCE_MANAGE` for calls,
`GROUP_CALL` for group calls and voice messages. Switches are read forgivingly (`true`, `True`, `1`, `yes`, `on`), but they are fixed at
bundle time: after changing `.env`, restart with `npx expo start --clear` (an APK needs the `live` profile in `eas.json`).

## Photo Record and Video Record

Both are under More (they need `photos:read` and `videos:read`) and are built from the web's media module.

- **Photo Record.** Pictures taken by the helmets, newest first, in a grid; filter by helmet and by day (the capture date, not the upload
  date). Tap one to see it large, with Previous and Next. A photo that hasn't arrived from the helmet yet says "Uploading from
  helmet…" and can't be opened, rather than showing a broken picture.
- **Video Record, Uploaded.** The recordings that have reached the server, as a file list with a status (Ready, Uploading, Failed),
  the helmet, when, and the size; filter by helmet, day and file name. A **calendar** shows which days have clips and how many, by
  the helmet's recording date (clips often upload days later); tap a day to list just that day. A Ready clip plays in a video player,
  and nothing downloads until you press play (clips run to about 100 MB).
- **Video Record, Videos on helmet.** Helmets record to a memory card and only some clips reach the server. Choose a helmet and how far
  back, and Refresh asks the helmet what it has (5 to 10 seconds; an offline helmet is reported at once). You can ask it to upload one
  clip or all of them. Nothing uploads without a tap, because uploads are large; the tab warns that a phone hotspot uses a lot of
  data. Uploads can take several minutes, and the list checks every 10 seconds and refreshes Uploaded when one arrives.
- **Not built:** deleting. The web hides delete on the live backend too, because E5 haven't decided who may delete.
- Every photo and video link is signed and expires after about an hour, so the list refreshes well inside that, and the viewer reloads
  it once if a link fails.
- The backend has no fleet-wide photo or video list, so "all devices" asks each helmet in turn (fine at this fleet size).

## The Google map

On an Android tablet the Live Map, the fence editor and track playback use Google's own map when the build was made with a Google Maps key, and the
OpenStreetMap map otherwise (and always in the browser preview). The key and the optional Map ID are set on EAS, never in the repository. How to set
them up, what to do if the map is grey, and what it costs: [docs/GOOGLE_MAPS.md](docs/GOOGLE_MAPS.md). It has not yet been run on a tablet.

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
- **Critical alarms** (SOS, SOS button, fall, near electricity, no movement, and the four gas alarms)
  open a large red box in the middle of the screen, over everything, and sound a looping siren with
  vibration. The box stays until someone acts. It shows a short title ("SOS pressed", "Carbon monoxide"),
  the wearer and helmet, and a line of detail (a gas alarm also shows the helmet's latest reading of
  that gas). Its buttons are **View on map** (if the account may open the Live Map), **Join call**
  (SOS only, and only if the account may call) and **Close**. Any button, or opening the alarm, counts
  as acting: it stops that alarm's siren and brings up the next one waiting, so several alarms at once
  each get their turn (the box says "Alarm 1 of 2"). Acting is per tablet. The alarm stays in the
  Alarms list, and on the tab's badge, until it is resolved. The alert window is 30 minutes, matching
  the backend's rule for joining an SOS call. The rules are in `modules/alarms/lib/alert-policy.ts`
  and the wording in `modules/alarms/lib/alarm-copy.ts`.
- **Warnings** get one chime and a small banner at the top centre with the same three parts. It goes
  by itself after 6 seconds, and tapping it opens the alarm.
- **A helmet with an open alarm** shows a red **Alarm** or an amber **Warning** pill on its card and on its own page. The backend's
  helmet list carries no alarm state, so it is worked out from the open alarms (`modules/devices/lib/alarmState.ts`).
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
eas init                       # once: links the project. Then copy its id into e5.local.json (docs/PUSH_SETUP.md):
                               # unpacking a zip replaces app.json, which would lose it
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
  produces the same kind of APK without the internal-distribution page. A third, `live`,
  is `preview` with live view and calls switched on. Each names the EAS environment whose
  variables it uses (`eas.json`), which is where the Google Maps key comes from.
- **Google Play.** `production` builds an app bundle (`.aab`), the only format Play takes; `preview` and `live` stay APKs. The checklist, the
  decisions to make first and what was verified is in [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md).
- **Code shrinking is off.** Android's release shrinker (R8) is switched off in `app.json`
  (the `expo-build-properties` plugin). With it on, the build failed in the `minifyReleaseWithR8`
  step with `Missing class org.webrtc.Dav1dDecoder$Natives`: WebRTC's library refers to a piece of
  an optional video codec that isn't packaged in it. The shrinker also removes and renames code it
  thinks is unused, and WebRTC's native code finds its classes by name, so a mistake would only
  show as a crash during a call. The cost is an APK a few megabytes larger. The rule that silences
  the warning (`-dontwarn org.webrtc.Dav1dDecoder$Natives`) is kept in the same plugin, so turning
  shrinking back on later (`enableMinifyInReleaseBuilds`) means changing one value, and then testing
  a call on a tablet.
- **If a build fails.** Open the build's link, and in the red phase search the log for
  `What went wrong`; the reason is printed under it. "Gradle build failed with unknown error" is
  only Expo's label for a failure it couldn't classify.
- **Native code.** Calls and live video (WebRTC) will need native modules and a new APK
  installed again; small JavaScript fixes can go over the air once `expo-updates` is set up.
