# Releasing on Google Play

Android only. The app has never been built or configured for iOS, so there is no App Store release without separate work.

## Where the project stands

Checked on this project:

- The `production` profile builds an app bundle (`.aab`), which is the only format Google Play takes. `preview` and `live` still build APKs for testing on tablets.
- Target SDK is 36. Google requires 36 for new apps and updates from 31 August 2026.
- Permissions are camera, microphone, network, vibration, wake lock, audio settings and Bluetooth. None needs a special Play declaration. Storage and overlay permissions are removed on purpose.
- Google's 16 KB memory page rule: the 64-bit libraries in WebRTC (`org.jitsi:webrtc` 155.0.1) are 16 KB aligned, read from the published file. The 32-bit ones are not, and 32-bit is exempt. Play Console's bundle explorer is the final judge.
- Phones: the manifest declares the app tablet-only (`plugins/withTabletScreens.js`, 600 dp), which Google documents Play as filtering on, and the app shows phones only a message if one gets through anyway (docs/TABLETS_ONLY.md). Some developers report phones still being offered tablet-only apps, so treat the manifest as a filter and not a guarantee.

Not checkable from here: Google's review of the listing and of the first release.

## Decisions made

- **Public listing.** Anyone can find and install the app, and only people with an account issued by an E5 administrator can sign in. The store text has to make that clear, and the listing shows E5's developer name and a support email to everyone.
- **Every feature ships in the first version.** The `production` profile turns on live view, calls, group calls and push alerts (`EXPO_PUBLIC_LIVE_ENABLED` and `EXPO_PUBLIC_PUSH_ENABLED`).

## Decisions still open

1. **Who owns the account.** It should be E5, not one person. An organisation account needs a D-U-N-S number (up to 30 days to get) and skips the closed test. A personal account created after 13 November 2023 must first run a closed test with 12 testers opted in for 14 continuous days.
2. **Signing key.** Google re-signs the app with its own key ("Play App Signing"), and this must be chosen at the first upload.
   - Let Google generate it. Then add the key's SHA-1 (Play Console, App integrity) to the Google Maps API key's allowed list, or the map goes grey. A tablet with the sideloaded APK cannot be updated from Play: it has to be uninstalled first, because the signatures differ.
   - Upload the existing EAS key as the app signing key (Google's PEPK tool). The Maps key and the installed tablets keep working, and Play updates replace sideloaded installs.
3. **Where the build project lives.** Today it is under a personal Expo account. Push credentials are stored in the Expo account, so E5 should own an Expo account or organisation and the project should move into it.

## Steps

1. Create the Play Console account and complete its identity checks.
2. Create the app: name, default language, app (not game), free.
3. Complete the dashboard tasks:
   - Store listing: short description (80 characters), full description (4,000), icon 512 x 512, feature graphic 1024 x 500, at least two screenshots, ideally 7 inch and 10 inch tablet ones taken on a real tablet.
   - Privacy policy URL. The app handles worker names and phone numbers, helmet locations, microphone and camera.
   - App access: Google reviewers need a working login, and a note that live view and calls need a helmet. Ask Cypher for a reviewer account on the real backend.
   - Ads: none. Target audience: adults. Content rating questionnaire. Data safety form.
4. Before the production build, have push ready (docs/PUSH_SETUP.md): a Firebase project for `com.e5energy.smarthelmet`, its `google-services.json` added as the file variable `GOOGLE_SERVICES_JSON` in the Production environment, and the FCM V1 key uploaded with `eas credentials`. Without them the app builds, and tells each tablet that alerts can't be received.
5. Build: `npx eas-cli build --platform android --profile production`.
6. Make the first upload by hand: Testing, Internal testing, Create release, upload the `.aab`. After that exists, `npx eas-cli submit --platform android --profile production` can upload later builds, using a Google service account key stored in EAS credentials, never in the repository.
7. Add testers, share the opt-in link, test on a tablet, fix, then closed testing and a production access request if the account needs it.
8. Register the package name `com.e5energy.smarthelmet` with Google's developer verification (Play Console does it for published apps). It applies to sideloaded apps as well when it reaches Nigeria in the 2027 global rollout.

## Before filling in the Data safety form

It is a legal statement. Confirm with E5 and Cypher what is collected and where it goes. What the app does, as built: sends the username and password to E5's backend; shows helmet positions and worker details the backend returns; records audio clips and voice messages with the microphone; uses the camera only for video calls; registers a random install id for push alerts (when switched on); loads map tiles from Google or OpenStreetMap.
