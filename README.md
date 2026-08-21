# TOME Loyalty App

A stamp-card loyalty app for Outlets, built with [Expo](https://docs.expo.dev/versions/v57.0.0/) (SDK 57) and Firebase. Users collect stamps on digital loyalty cards, browse participating brands on a map, and customize their card's appearance.

## Getting started

```bash
npm install
cp .env.example .env     # then fill in the Firebase web config values
```

Run it:

```bash
npm start                # Metro, choose a target
npm run android          # native Android build
npm run ios              # native iOS build
npm run web              # static web output
npm run lint
```

Native builds need a prebuild after any change to `app.json` plugins or permissions:

```bash
npx expo prebuild --clean
```

## Environment

All six values come from the Firebase console (Project settings → Your apps → Web app). They are
`EXPO_PUBLIC_*`, so they are compiled into the client bundle — this is expected for Firebase web
config, which is not secret. Access control lives in the Firestore rules, not in these keys.

```
EXPO_PUBLIC_FIREBASE_APIKEY
EXPO_PUBLIC_AUTH_DOMAIN
EXPO_PUBLIC_PROJECT_ID
EXPO_PUBLIC_STORAGE_BUCKET
EXPO_PUBLIC_MESSAGING_SENDER_ID
EXPO_PUBLIC_APP_ID
```

The default Firebase project is `tome-loyalty-web-app` (see `.firebaserc`).

## Layout

```
src/app/            expo-router routes; (tabs)/ is the five-tab shell
src/components/     UI, grouped by the screen that owns it
src/services/       Firestore access — userService, stampService
src/contexts/       userContext (auth + profile)
src/constants/      theme: Colors, Fonts
src/utils/          rng: seeded randomness for stamp card art
assets/classes/     shared TypeScript types (users, stamps, maps)
firebase/           Firebase SDK initialization
```

Path aliases: `@src/*` → `src/*`, `@/assets/*` → `assets/*`, `@/*` → repo root.

### Routes

| Route | What it is |
|---|---|
| `/` | Sign-in |
| `/(tabs)/home` | Stamp card summary |
| `/(tabs)/collection` | All of the user's stamp cards |
| `/(tabs)/scanner` | Placeholder — receipt scanning is being rebuilt |
| `/(tabs)/map` | Participating brands |
| `/(tabs)/others` | Profile and settings |
| `/edit/stamp/[stamp_ID]` | Stamp card customization |

`scanner` is the center FAB in the tab bar. It currently renders a placeholder; the receipt-scanning
implementation was removed and is being rewritten.

## Data model

Two collections are in use. Rules live in `firestore.rules` and are deployed with
`npx firebase deploy --only firestore:rules`.

| Collection | Access |
|---|---|
| `users/{uid}` | Owner read, create, update. No deletes. |
| `stamps/{stampId}` | Owner read only, matched on `owner_ID`. All client writes denied. |

Reads of `stamps` **must** filter on `owner_ID == uid` — the rule is evaluated per-document, so a
query without that `where()` clause fails with permission-denied. That is intentional.

`stamps` writes are closed to clients so a user cannot mint their own stamps. Stamp awarding is meant
to happen server-side; no writer exists right now.

Everything else is denied by an explicit catch-all. Cloud Storage is fully closed
(`storage.rules`) — open paths deliberately, per feature, as they are needed.

> `stampService` writes to `stamps` via the client SDK today (`addNewStamp`, `updateStamp`,
> `deleteAllStampsByOwner`, `uploadBgImage`). Those calls are blocked by the deployed rules and by
> the closed Storage rules. Reconcile this before relying on them.

## Testing

There is no test runner configured. The previous suites belonged to the removed receipt feature.
