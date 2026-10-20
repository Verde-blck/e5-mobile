# Group call

The web's Group Call page has two modes. The app has one of them.

## Voice message: built, switched off in a real build until checked

Choose a group, choose helmets, record a message, listen back, send it, and see what happened to **each** helmet:
played now, queued because the helmet is offline (it plays when it reconnects), or not sent. A deactivated helmet is
skipped; an offline one is kept. In sample-data mode all of this works end to end.

In a real build the screen and its menu row stay hidden (and the send refuses) until `EXPO_PUBLIC_BROADCAST_ENABLED=true`.

**The request now matches the web exactly** (its `messaging/api/messages.api.ts`): `POST /api/broadcast`, multipart, with
`file` and `deviceIds` as one comma-joined string; the answer is `{ helmets: [{ deviceId, delivered, messageId }] }`. An
empty list is never sent, because leaving `deviceIds` out would send to every active helmet.

**What is still unconfirmed is the audio format, and it is the only thing left.** The web now sends **MP3** (it encodes
in the browser). An Android tablet can only record AAC in an `.m4a` file and cannot make MP3 or WAV. The backend already
converts `.m4a` to MP3 for fence clips; it needs to do the same on `POST /api/broadcast` and
`POST /api/devices/{id}/messages/audio`. Until Cypher confirms, a recording would be refused (shown as "not sent").

To switch it on: get Cypher's confirmation, set the flag for a build, and send a test message to one helmet.

## The same switch covers a message to one helmet

More > a helmet > **Voice messages** is a conversation with that helmet (`GET /api/devices/{id}/messages`, and
`POST /api/devices/{id}/messages/audio` to send, multipart `file`). Reading is always available; sending uses the same
`EXPO_PUBLIC_BROADCAST_ENABLED` switch, and needs the same thing from Cypher: accept `.m4a` and convert it.
Recordings from a helmet are AMR; Android's own player reads AMR, so the app carries no decoder (this is the one part
not provable without a real helmet recording on a real tablet).

## Live group call: not built

The call mode (talk live with up to 8 helmets, with video) is the one-helmet session in `docs/CALLS.md` several times over:
`POST /api/webrtc-group-call/start` returns one call room and a watch address per helmet, with `GET` to rejoin and
`POST .../{callId}/stop` to end it. The protocol is known (the web's live module was supplied); it is a separate piece of
work (a tile per helmet, joining each helmet and retrying, rejoining after the app restarts), and the web marks it beta
because it hasn't been tried with several real helmets. The screen says plainly that live group calls aren't available in
the app yet.

## Groups

Groups hold administrators, not helmets (the API has no helmet membership), so the helmets are picked each time, as on
the web. A role with group call, or with group management, can see the groups without being able to administer accounts.
