# The Google map on the tablet

On an Android tablet the **Live Map**, the **fence editor** and **track playback** use Google's own map, drawn natively, when the build was
made with a Google Maps key. Without a key the tablet shows the OpenStreetMap map, as it always has, so a tablet is never left without a map.
The browser preview (`npx expo start --web`) always shows the OpenStreetMap map, because Google's native map exists only in a built app.

Nothing about the screens changes. The three screens talk to one `MapSurface` component, and behind it there are now three engines: Google
(Android with a key), Leaflet in a web view (Android without a key, and iOS) and Leaflet in a frame (the browser preview).

## Setting it up (once)

The Google side (a key restricted to this app, and a Map ID of type Android) is described in the conversation with Gboz. Then:

1. **Put the key on EAS.** On expo.dev open the project, then **Environment variables**, then create:
   - `GOOGLE_MAPS_ANDROID_API_KEY` with the key as its value, in the **Preview** and **Production** environments, visibility **Sensitive**.
   - `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` with the Map ID as its value, in the same two environments, visibility **Plain text**
     (a setting that starts with `EXPO_PUBLIC_` is built into the app, so it can't be secret). This one is optional; see "Cost" below.
2. **Build a new APK.** Nothing changes until you do, because both settings are fixed when the app is built:
   `npx eas-cli build --platform android --profile preview` (or `--profile live`).
3. **Check the build log** for a line starting `[e5]` mentioning `GOOGLE_MAPS_ANDROID_API_KEY`. That line only appears if the key was rejected for not
   looking like a Google key (they start with `AIza` and are 39 characters), and it says what was wrong without printing the key.

Each build profile in `eas.json` names the EAS environment whose variables it uses (`preview` and `live` use Preview, `production` uses
Production). That is deliberate: a profile with a custom name and no `environment` quietly uses Production's variables.

## How to tell it worked

On the Live Map you see Google's map with the Google logo at the bottom left and zoom buttons at the bottom right. With a Map ID it has the
dashboard's style. If you see the OpenStreetMap map instead, the build had no valid key.

## If the map is grey or blank

A grey grid with the Google logo means the map loaded but Google refused to draw it. In order of likelihood:

1. **The key's restrictions don't match this build.** The SHA-1 on the key must be the one for the keystore this build was signed with (EAS's, from
   `npx eas-cli credentials --platform android`), and the package name must be exactly `com.e5energy.smarthelmet`.
2. **The Maps SDK for Android isn't enabled** on the Google Cloud project, or billing isn't switched on for it.
3. **A change was made in the last few minutes.** Google can take up to about five minutes to apply a new key or restriction.
4. **The Map ID is the wrong type.** It must be type **Android**, not JavaScript.

To get a working map straight away while this is sorted out, set `EXPO_PUBLIC_MAP_ENGINE` to `osm` in the same EAS environment and build again.
That uses the OpenStreetMap map in a build that has a key. Removing `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` and building again keeps the Google map but
drops the dashboard style.

## Cost

Google's own pricing page says a native Android map loaded **with a Map ID** is billed as "Dynamic Maps" (a free monthly allowance, then a price per
thousand loads), and one loaded **without** a Map ID is not billed. A load is each time a screen creates the map, not each pan or zoom. There is no
cap you can set for it, only budget alerts, so the Map ID is optional: leave `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` out and the map is free, in Google's
standard style.

## What is not exactly the same as the OpenStreetMap map

- A critical alarm's ring on a helmet does not pulse; it is a steady ring. (Animating a native marker means redrawing it constantly.)
- A selected helmet shows its name in Google's own pop-up above it, not as a permanent label beside it.
- A tap inside a saved fence selects it; this is worked out from where the tap fell, so circles and polygons behave the same.
- Everything else is drawn the same way: helmets coloured by whether they are reporting, accuracy circles, alarm pins, fences (work areas teal,
  no-entry zones amber), the fence being drawn with draggable handles, the route with A and B pins, and the playback marker.

## Status

Written and checked against the library's types, with the rules for what to draw and how to frame it covered by tests (`tests/nativemap.test.ts`,
`tests/mapkey.test.ts`). It has **not** been run on a tablet: a native map can't be run in the browser or on this computer. The first build is the
first real test, so look at the Live Map, draw and drag a fence, and play back a route.
