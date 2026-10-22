# Alarm alerts for a locked tablet

Without push, the app only hears alarms over a live connection that stops when the tablet's screen locks.
Push closes that gap. **The backend side is built** (Cypher, 20 Oct 2026; live with his next deploy), and the
app side is built and tested. What's left is set-up in E5's accounts, then one switch in the app.

## How it works

The backend sends each alarm to **Expo's push service**, which delivers it through Google FCM to the tablet.
The tablet registers an **Expo push token** (`ExponentPushToken[...]`) with the backend when someone signs in:
`PUT /api/push/registrations/{installId}`; signing out removes it. Two Android notification channels exist:
`sos` (the siren in `assets/sounds/sos.wav`, alarm volume, can pass Do Not Disturb) and `alarm` (everything else).
The backend decides which alarms are critical (SOS, fall, near-electric, no-movement/silent, **and gas at danger
level**) and names the channel in each push.

Tapping an alert opens that alarm. While the app is open and its own alarm connection is live, the system
notification is suppressed *only if the app itself will sound the siren for that alarm*; for a gas-danger alarm
(which the app alone would only chime for) the notification always shows.

More > Alarm alerts shows where it stands, with **Send a test alert** (works without the backend) and a shortcut
to the battery setting that decides whether a locked tablet can really be woken.

## What has to exist (all in E5's name)

1. **The backend deploy** (Cypher). He'll say when it's live.
2. **An Expo/EAS project, linked in `e5.local.json`.** Expo issues push tokens per project, and every `eas` command needs the link.
   Without it the tablet reports "can't receive alerts". The link is the project's **ID**, a UUID that looks like
   `4b8e1a52-7c3d-4f6e-9a21-0d5c8b7e3f10`: find it on the project's page at expo.dev, or run `npx eas-cli init` (if it offers to link the
   existing project, say yes; it writes the ID into `app.json`). It is **not** the project's name (`e5-smart-helmet`) or the account name.
   Then copy `e5.local.example.json` to **`e5.local.json`** and put in the real `projectId` (and `owner` if the project belongs to an
   organisation; leave `owner` out for a personal account). **Commit it.** This file is deliberately not in `app.json`: unpacking a new
   zip replaces `app.json`, which used to wipe these lines. No zip contains `e5.local.json`, so it is never touched. (The `EAS_PROJECT_ID`
   environment variable still works as a last resort.)

   Only a real project ID is passed on. Anything else (the name, an account name, text left from the example) is ignored, and any `expo`
   or `eas` command prints a line starting `[e5]` saying which value was ignored and why, instead of EAS failing with "Invalid UUID
   appId". To see what EAS is being given: `npx expo config --type introspect` (on Windows add `| findstr /i "projectId owner"`).
3. **A Firebase project** (console.firebase.google.com): add an Android app with package name
   `com.e5energy.smarthelmet`, download `google-services.json` and put it at the project root (or, on EAS, add it as
   a *file* environment variable named `GOOGLE_SERVICES_JSON`). The tablet still needs it to receive from Google.
4. **The FCM V1 service-account key, uploaded to EAS.** In Firebase: Project settings > Service accounts >
   Generate new private key. Then upload it with `eas credentials` (Android, the FCM V1 key for push). It stays in
   E5's Expo account: **Cypher never needs it**, and it must not be committed anywhere.
5. *Optional:* if you switch on "enhanced push security" in Expo, give Cypher the Expo access token privately
   (he adds it as `EXPO_ACCESS_TOKEN`). Otherwise nothing is needed.
6. **Tablets with Google Play services** (assumed for every tablet E5 supplies).

## Turning it on

1. Do steps 2 to 4 above, then build a new APK (`npm run apk`) with `EXPO_PUBLIC_PUSH_ENABLED=true` (`.env` locally,
   EAS environment variables for the build).
2. On each tablet: sign in, More > Alarm alerts > **Turn on alerts**, and allow notifications.
3. Press **Send a test alert**, lock the screen, and confirm the siren sounds and the alert shows on the lock screen.
4. Set the app to *Unrestricted* / *Don't optimise* under the tablet's battery settings (the app has a shortcut).
5. Raise a real test alarm from a helmet and confirm it reaches the locked tablet.

Until step 1 the app says plainly that alerts need the app to be open, and nothing is requested from the backend.

## Limits worth knowing

- **Delivery is best effort** (Google, via Expo). Much better than nothing, but not a guaranteed siren: a tablet that
  is switched off, offline, or where the maker's battery saver kills the app can still miss one.
- **A third party is in the path.** Expo's push service carries each alert (helmet name, alarm type, time; no
  coordinates). The earlier plan, direct to Google, would not have had one. Worth E5 knowing.
- **Clearing a resolved alarm's notification** (a data-only push) works while the app is open. With the app in the
  background Android doesn't run app code for it, so the notification stays until dismissed. A background task could
  fix that; it isn't built.
- **No collapse tag:** Expo has none, so a repeat push for the same alarm can stack.
- **A lost tablet** is cut off by deleting the account (`DELETE /api/admins/{id}`; its token then gets 401 and its push
  registrations are dropped). Logout, revoke-sessions and disable endpoints aren't built.
- The siren on the lock screen comes from the channel. A person can lower or silence a channel in the tablet's
  settings; Android keeps the person's changes.
- The lock screen shows the helmet's name and the alarm type. If that is too much, ask Cypher for generic text.
