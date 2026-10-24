# Tablets only

E5 Command Centre is for tablets. An APK shared by a link installs on any Android phone, and Android has no way to refuse that, so the app
checks the screen when it opens and, on a phone, shows one message and nothing else:

> **This app is for tablets**
> E5 Command Centre is used on a tablet. Please open it there to sign in.

There is nothing to press on that screen: no sign-in, no link, no way past it. Behind it nothing runs: no saved session is restored, and
no alarm stream or push alert starts.

## How a tablet is told from a phone

By the smaller side of the whole screen, in dp (the unit Android measures screens in): **600 or more is a tablet.** A typical phone is
about 320 to 430 dp, a 7 inch tablet is 600, and a 10 inch tablet is 720, so 600 keeps every 8 inch tablet and blocks every phone. It
cannot tell 7 inches from 8, because dp is not inches. The rule is in `src/shared/lib/tabletGate.ts` and is tested against real device sizes.

- It measures the **screen**, not the window, so a tablet in split-screen (a narrow window) is still a tablet.
- It is the same whichever way the device is held: it uses the smaller side.
- It re-checks when the screen changes, so a foldable opening out is let in, and closing it shows the message.
- A screen that cannot be measured is let through. The gate must never lock a real tablet out on a guess.
- A foldable opened out (about 7.6 inches, 673 dp) passes: it is above the line.
- A tablet whose **Display size** (Settings, Display) is set to the largest value has a smaller dp width and can fall under 600. The message
  shows the measured width and says how to fix it.

## What it applies to

Android builds only. The browser preview (`npx expo start --web`) is never blocked, because it is a development tool and has no phone
to test on; iOS is not a target of this app.

## Turning it off (for testing on a phone)

Set `EXPO_PUBLIC_TABLET_ONLY` to `false` and build again. For an EAS build, add it as an environment variable in the same environment as the
other settings (see GOOGLE_MAPS.md): name `EXPO_PUBLIC_TABLET_ONLY`, value `false`, visibility Plain text. Remove it, or set it to `true`, to
keep phones out. To try it on a phone while developing locally, put `EXPO_PUBLIC_TABLET_ONLY=false` in `.env`.

Like every `EXPO_PUBLIC_` setting it is fixed when the app is built: changing it needs a new APK.

## Testing it in a browser

In the browser preview, set `window.__e5TabletOnly = true` before the app loads (a browser has no phone). The test in
`verify/tabletgate.py` does this and checks many phone and tablet sizes. In the console on a page that is already open, the setting only
takes effect after a reload.

## What it cannot do

It cannot stop an install: a phone can still install the file, and will show the message. To stop the install itself the app has to be
published through Google Play (a private app is possible), where a smallest-width of 600 and a list of excluded devices both keep phones
from seeing it, or pushed by a device-management tool to enrolled tablets only. Otherwise, keep the build link private.
