# Group call and voice messages

## Group call: calling a helmet

The **Group call** module is where a helmet is called: choose a helmet, then **Audio call** or **Video call**. A video call
sends the tablet's front camera as well as its microphone, shows it as a small self-view, and has a camera button (off sends
black frames, so it is instant). A tablet with no camera carries on as an audio call and says so. The first video call asks
Android for camera access; a refusal is reported before the helmet is touched. See `docs/CALLS.md` for how a call works and
what can't be known without a real helmet.

### Live calls with several helmets: not built

A call with up to 8 helmets at once is the one-helmet session several times over: `POST /api/webrtc-group-call/start` returns one
call room and a watch address per helmet, with `GET` to rejoin and `POST .../{callId}/stop` to end it. The protocol is known (the
web's live module was supplied); it is a separate piece of work (a tile per helmet, joining each and retrying, rejoining after
the app restarts), and the web marks it beta because it hasn't been tried with several real helmets.

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
