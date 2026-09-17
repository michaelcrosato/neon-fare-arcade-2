# Google account sync

Optional. Signed out, Neon Fare behaves exactly as it did before this existed:
the career lives in `localStorage` and nothing leaves the device.

## Why there is no backend

The save is a few hundred bytes of JSON. It is written straight from the
browser into the player's own Google Drive, in the hidden per-app folder Drive
provides (`appDataFolder`).

That choice buys a lot:

- **No server, no database, no secrets, no ops cost.** `.openai/hosting.json`
  stays `d1: null, r2: null`.
- **No data custody.** We never hold player data, so there is no breach surface
  and no obligation over someone else's save.
- **No Google verification review.** All three scopes are non-sensitive, which
  is the only reason the app can be published for everyone straight away.

The cost is that this cannot back a leaderboard. Global scores would need a
real server and a database, which is a separate capability request.

## Google Cloud configuration

Project `neon-fare-arcade`, under the Google Auth Platform.

| Setting | Value |
| --- | --- |
| Consent screen app name | Neon Fare |
| Audience | External, **In production** |
| Scopes | `openid`, `.../auth/userinfo.profile`, `.../auth/drive.appdata` |
| Enabled API | Google Drive API |
| OAuth client | Web application, "Neon Fare Web" |
| Authorized JS origins | `https://neon-fare-arcade-2.vercel.app`, `http://localhost:4173`, `http://localhost:5173`, `http://127.0.0.1:4173` |
| App domain links | `/`, `/privacy`, `/terms` on the production host |

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` carries the client ID. It is public by design --
it ships inside the client bundle -- and this flow uses **no client secret**,
so there is no credential in this project to leak or rotate. The variable is
set on Vercel for Production only; preview deployments leave it unset so the
feature stays dark rather than offering a button that cannot work from an
unregistered origin.

### Things that would break the published app

Google re-gates an app that changes any of these, and an app awaiting
verification is unavailable to everyone:

- Adding a **sensitive or restricted scope**. `drive.appdata` is non-sensitive;
  plain `drive` is restricted and would be a different product decision.
- Uploading an **app logo** to the consent screen.
- Exceeding **ten authorized domains**.
- Removing `/privacy` or `/terms`. Those URLs are registered on the consent
  screen, and publishing was blocked until they existed.

### Adding a new origin

A new deployment host needs its origin added to the OAuth client *and* its
domain added to Authorized domains, or sign-in fails there with
`redirect_uri_mismatch`. Google warns changes take five minutes to a few hours.

## How a sync goes

1. `requestGoogleToken` gets an access token through the GIS popup. Tokens last
   about an hour and there is no refresh token in a browser, so renewal is a
   silent `prompt: ""` request that may fail for ordinary reasons.
2. `findCloudSaveFile` looks for `neon-fare-career-v1.json` in `appDataFolder`.
3. `planCareerSync` in `game/career-sync.ts` decides: upload, adopt, in-sync,
   or ask the player.
4. After that, a banked run pushes to Drive on a debounce. The device save is
   always written first; the network is never on the path of banking a run.

## Conflict rule

Saves are ranked by **monotonic progress** -- runs, lifetime fare, lifetime
score, deliveries, items owned, furnishings owned -- and never by timestamp. A
device with a wrong clock must not erase a career that is plainly further
along. Bank is deliberately excluded because it is spendable: a smaller bank
often means a *further* along career.

If one save contains the other, it wins silently. If neither does, both hold
runs the other never saw, and the player picks. That is the only case that
interrupts anyone, and it is the only case where a choice is unavoidable.

## Verifying a change

```
npm run test:file -- tests/game/career-sync.test.ts
npm run check:fast
```

Browser verification needs an origin that is registered above. `npm run play`
uses port 4173; if another project holds it, run
`npx next dev --hostname localhost --port 5173` and browse to
`http://localhost:5173` -- **not** `127.0.0.1:5173`, which Google treats as a
different origin.

To re-test a first sign-in, withdraw access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions),
which also deletes the app folder and the save inside it.
