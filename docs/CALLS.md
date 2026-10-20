# Live view and calls with a helmet

## State: built to the web's own protocol, not yet tried on a real helmet

Live view ("Watch live") and one-to-one calls are built on the web dashboard's live module (supplied 20 Oct 2026) and the
backend's Helmet Video & Live Stream guide. They work end to end in sample-data mode and in the browser preview. **They have
not been tried on a real tablet with a real helmet and media server**, which is why a real build keeps them hidden until
`EXPO_PUBLIC_LIVE_ENABLED=true`.

## What it does

- **Watch live** (needs live view, `live:read`): the helmet's camera and sound. The sound starts off, with one tap to turn
  it on. Closing only closes this tablet's connection (others may be watching, and the helmet stops by itself about 20
  seconds after the last viewer leaves). **End stream for everyone** is separate and asks first.
- **Call helmet** (needs `live:write`) and **Join SOS call** (anyone signed in, for a helmet with an open SOS in the last 30
  minutes): you hear and see the helmet and the wearer hears you. The tablet sends **voice only** and never uses its own
  camera, so the app carries no camera permission. A refused microphone is reported **before** the helmet is touched, so a
  helmet is never left in call mode by a call that couldn't start.
- A call ends, and takes the helmet out of call mode, whenever it ends: hang up, leave the screen, or leave the app for more
  than 4 seconds. A glance away (the notification shade, a permission dialog) doesn't end it.

## How it works

`POST /devices/{id}/live/start` or `/webrtc-call/start` makes the helmet start and returns media-server addresses. The tablet
then POSTs its WebRTC offer as plain text to that address and gets `{ code, sdp }` back (ZLMediaKit). Code 0 is connected;
anything else usually means the helmet hasn't started sending yet, so it retries every 2 seconds for up to 30. There are no
STUN or TURN servers. The picture is received from the watch address and, in a call, the microphone is sent to the push
address. `webrtc-call/stop` ends a call; `live/stop` ends a stream for everyone.

On the tablet this runs on `react-native-webrtc`; the browser preview runs the same exchange on the browser's own WebRTC. In
sample-data mode the media addresses are fake and answered with a generated test picture.

## Turning it on, and what to try

1. Build with `EXPO_PUBLIC_LIVE_ENABLED=true` and install on a tablet. `eas.json` has a `live` profile that does this (and turns on
   voice-message sending too): `eas build --platform android --profile live`. A local `.env` is not uploaded to EAS, so for an
   APK the switch has to be in `eas.json`; for `npx expo start` put it in `.env` and restart with `--clear`.
2. With the test helmet: **Watch live** (does the picture arrive within about 10 seconds? does the sound work?), then a second
   viewer, then close one and check the stream carries on.
3. **Call helmet**: can you hear it and can it hear you? Hang up and confirm the helmet leaves call mode.
4. **Join SOS call** from an SOS alarm, and from the banner.
5. Leave the app mid-call for 5 seconds: the helmet should leave call mode.
6. Try it on the connection the tablets will really use (site Wi-Fi, and mobile data).

## What can't be known from here

- **The real network path.** With no STUN or TURN, it relies on the media server being reachable directly. That works for the
  web dashboard, but a tablet on mobile data or behind a stricter firewall may behave differently. If it doesn't connect,
  ask Cypher whether the media server advertises a public address.
- **react-native-webrtc on a real device** (the stream handoff, the audio route). The tablet's speaker is the normal output;
  there is no speaker toggle.
- **A tablet that is killed or crashes mid-call** can't tell the backend, so the helmet stays in call mode. The web has the
  same gap and covers closing a tab; for the app, ask Cypher to take a helmet out of call mode by itself when the admin's
  media connection drops, as live view already does after about 20 seconds.

## Live wall

The **Live wall** module shows up to six helmets at once, each its own session (so one helmet with no picture never affects the
others), every tile muted, with enlarge-for-sound. It is the web's wall without the pop-out window. Each streaming helmet uses about
0.9 GB of its own mobile data an hour, so leaving the wall (another tab) or the app disconnects every helmet, and returning
reconnects the same ones. It needs live view (`SURVEILLANCE`) and the same switch as everything else here.

## If you can't find any of it

Open More > **What's switched on**. It says, for each feature, whether the build's switch or the account's permission is what's
hiding it. After changing `.env`, restart with `npx expo start --clear`; the switches are baked in when the app is bundled.

## Not built: live group call

The protocol is now known (`POST /api/webrtc-group-call/start` with up to 8 helmets, one call room, `GET` to rejoin,
`POST .../{callId}/stop`), and the session code is the one-helmet session above, several times over. It is a separate piece
of work: a tile per helmet, per-helmet joining and retry, and rejoining after the app restarts.
