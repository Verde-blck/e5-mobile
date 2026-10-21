# Group call and voice messages

## Group call: calling helmets

The **Group call** module is where helmets are called: tick one or up to 8, then **Video call** or **Audio call**.

- **One helmet** is the ordinary one-to-one call (`docs/CALLS.md`; needs `live:write`).
- **Two or more** is a **group call** (needs `groupCall:write`, the backend's `GROUP_CALL`, as in the web). One request,
  `POST /api/webrtc-group-call/start` with the helmet ids (at most 8), returns one call room: a `callId`, an `adminPushUrl` (where
  this tablet's microphone and camera go, **once**, for every helmet to hear) and, per helmet, `delivered` and a `watchUrl`. Each
  helmet that was reached is its own incoming connection, so one weak signal never affects the others, and each can be retried on
  its own. A helmet that is offline comes back `delivered: false`: calls aren't queued, so it shows "not reachable" and won't join
  later. `POST /api/webrtc-group-call/{callId}/stop` ends it on every helmet in one go; it is sent on every way out.
- As on a call, the camera and microphone are asked for **before** any helmet is touched, so a refusal never leaves a helmet in
  call mode, and a tablet with no camera carries on as voice.
- A tablet can't keep a call in the background: out of sight for more than a few seconds ends it, for every helmet.
- **A call left running.** If the app is killed mid-call it can't tell the helmets, which stay in call mode. The call's id is
  remembered, and the next time the Group call page opens it checks (`GET /api/webrtc-group-call/{callId}`; 404 means it has
  ended) and offers to end it. Rejoining a running call isn't offered.

**Beta.** This is the web dashboard's `GroupCallSession` ported, to the backend's guide of 13 Oct 2026. Whether the helmet app shows
and plays several other participants hasn't been confirmed on real hardware (there is one test helmet), which is why the web
calls it beta too. It needs `EXPO_PUBLIC_LIVE_ENABLED=true` like the other live features.

## Voice messages: one helmet, from its own screen

A voice message is sent to **one helmet**, from that helmet's screen (More > a helmet > **Voice messages**). There is no sending to
several helmets. It is a conversation (`GET /api/devices/{id}/messages`; `POST /api/devices/{id}/messages/audio` to send,
multipart `file`). Reading is always available. Sending needs `EXPO_PUBLIC_BROADCAST_ENABLED=true` and the permission
(`groupCall:write`, backend `GROUP_CALL`).

### The recording's format

- **In a browser (the preview):** the recording is WebM, which the helmets can't play. The app converts it to a 16 kHz mono WAV, the
  encoding the web dashboard uses (and the web sends MP3 now; WAV is its fallback). It is attached as a real file. An earlier version
  attached it as an object, which a browser turns into the text `[object Object]`, so the server received no audio at all and every
  send failed whatever the connection.
- **On a tablet:** Android records AAC in an `.m4a` file and cannot make WAV or MP3. The backend already converts `.m4a` to MP3 for
  fence clips; it needs to do the same on `POST /api/devices/{id}/messages/audio`. This is unconfirmed, so a tablet's first send is
  the real test. If the server refuses it the message will say so, with the server's code and its own words.

### When a send fails

The message says what happened: no answer at all is "couldn't reach the server, check the connection"; a 401 is "sign in again"; a
403 is "this account isn't allowed"; a 413 is "too large (about 10 MB)"; a 400 or 415 is "the server didn't accept the recording,
it may not take this audio format"; a 5xx is "the server had a problem, the connection is fine". Each carries the server's own code
and words underneath. Only a missing answer says to check the connection.
