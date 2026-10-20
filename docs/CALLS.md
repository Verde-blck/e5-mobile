# Calls with a helmet

## State: the app side is built; the call itself is not

Built and tested against a **simulated** engine (sample-data mode and the browser preview):

- **Who may call** (`modules/calls/lib/access.ts`), the backend's rule: anyone signed in may join a call for a
  helmet with an **open SOS alarm raised in the last 30 minutes**; any other call needs `SURVEILLANCE_MANAGE`
  (`live:write`). The app only decides what to *offer*; the backend decides what is *allowed*.
- **Entry points:** *Join call* in the SOS banner (one tap while the siren is going), *Join SOS call* on an open
  SOS alarm, *Call helmet* on a helmet. Each appears only when this build can call and this account may.
- **The call screen** (`/call/[deviceId]`): microphone, connecting, in-call timer, mute, speaker, hang up, and
  a plain screen for each failure (microphone blocked, refused, helmet unreachable, dropped, helmet hung up).
  Leaving the screen ends the call, including one still connecting.
- **The seam** (`modules/calls/lib/engine.ts`): the screens, state machine and access rule don't know what a
  call is made of. A real build currently reports calling as **unavailable** (`engines.ts`), so no Call button
  is shown that can only fail.

## What real calls need

1. **The signalling.** I don't have it. I need what `POST /devices/{id}/webrtc-call/start` returns and how the call
   is set up and torn down: SDP and ICE exchange, the stop/hang-up request, STUN/TURN settings, and whether the
   tablet's audio reaches the helmet through ZLMediaKit or through Asterisk (SIP). The web dashboard already
   does all of this, so its call code is the best source (plus Cypher's guide for calls and live view).
2. **A WebRTC engine** implementing `CallEngine`, on `react-native-webrtc` with `@config-plugins/react-native-webrtc`.
3. **A real tablet and a real helmet** to test on. A call can't be proven without both.

## Build check already done (scratch copy, not in the project)

Adding `react-native-webrtc` 155 and its Expo plugin to a copy of this project and running Expo's Android
prebuild **succeeds** (New Architecture on). It adds `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH` and
`WAKE_LOCK`, and also `CAMERA`, which an audio-only call doesn't need. When the engine is added:

- block `android.permission.CAMERA` in `app.json` (`blockedPermissions`);
- turn the microphone on in the `expo-audio` plugin (`recordAudioAndroid`, `microphonePermission`), which is off today;
- expect the APK to grow (native WebRTC libraries).

The dependency is deliberately **not** in the project yet: it would add weight for nothing until the signalling is known.

## Decisions to make

- **Does a call survive the screen locking?** Version one assumes **no**: a call is for someone looking at the
  tablet. Keeping a call alive while locked needs an Android foreground service and a permission prompt of its own.
- **Live video** (watching the helmet camera) is the same signalling family and comes after calls.
- **Group calls** use a different path (Asterisk/SIP, per the web's module) and are a separate piece of work.
