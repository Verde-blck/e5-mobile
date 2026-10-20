# Alarm alerts for a locked tablet

Today the app is **foreground-only**: it hears alarms over a live connection that stops when the tablet's
screen locks. Push alerts close that gap. They need three things outside this repo, then one switch inside it.

## What the app does (already built)

- Creates two Android notification channels: `sos` (max importance, the siren from `assets/sounds/sos.wav`,
  alarm volume, can pass Do Not Disturb) and `alarm` (everything else).
- After sign-in, if the tablet has allowed notifications, it fetches the tablet's own **FCM token** and registers
  it with the backend (`PUT /api/push/registrations/{installId}`); signing out unregisters it.
- Tapping an alert opens that alarm. While the app is open and its alarm connection is live, the system
  notification is suppressed (the app's own banner and siren already run), and shown again if the connection drops.
- More > Alarm alerts shows where it stands, with a **Send a test alert** button (works without the backend) and a
  shortcut to the battery setting that decides whether a locked tablet can really be woken.

## What has to exist first

1. **Cypher's side** (see the request to Cypher): registration endpoints, sending the push on each alarm with the
   channel ids above, and dropping registrations when an account is deleted or its sessions are revoked.
2. **A Firebase project in E5's name** (not a personal one):
   1. console.firebase.google.com > Add project > Cloud Messaging is on by default.
   2. Add an Android app with package name `com.e5energy.smarthelmet`.
   3. Download `google-services.json` and put it at the project root (or, on EAS, add it as a *file* environment
      variable named `GOOGLE_SERVICES_JSON`).
   4. Project settings > Service accounts > generate a private key, and give it to Cypher **privately** (it lets the
      backend send push; it must not be committed anywhere).
3. **Tablets with Google Play services** (assumed for every tablet E5 supplies).

## Turning it on

1. Put `google-services.json` in place and build a new APK (`npm run apk`).
2. Set `EXPO_PUBLIC_PUSH_ENABLED=true` for that build (`.env` locally, EAS environment variables for the build).
3. On each tablet: sign in, More > Alarm alerts > **Turn on alerts** and allow notifications.
4. Press **Send a test alert**, lock the screen, and confirm the siren sounds and the alert shows on the lock screen.
5. Set the app to *Unrestricted* / *Don't optimise* under the tablet's battery settings (the app has a shortcut).
6. Raise a real test alarm from a helmet and confirm it reaches the locked tablet.

Until step 2 the app says plainly that alerts need the app to be open, and nothing is requested from the backend.

## Limits worth knowing

- Delivery is by Google's servers and is **best effort**. It is much better than nothing, but it is not a guaranteed
  siren: a tablet that is switched off, offline, or where the maker's battery saver kills the app can still miss one.
- The siren on the lock screen comes from the notification channel. A person can lower or silence a channel in the
  tablet's settings; the channel is created once and Android keeps the person's changes.
- Notifications carry the helmet's name and the alarm type on the lock screen. If that is too much to show on a
  locked screen, tell Cypher to send generic text and keep the details in the data payload.
