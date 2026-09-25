# Send2U In-App Update System — Implementation Plan (v2)

> **Revision note:** v1 of this plan was written against the repo as of commit `c29945f`. The repo has since moved to `47d278f3` and gained EAS build infrastructure, a platform-managed payment model, and a `lib/` test suite. v2 corrects the assumptions that changed. See "Corrections from v1" at the end.

**Goal:** A friend who sideloaded the Send2U APK taps one button inside the app and gets the new version, with no app store, no manual APK passing, and no uninstall.

**Architecture:** Two-tier updates.
- **Tier 1 — OTA (`expo-updates`)** updates the JS bundle and assets in place. Covers the large majority of iteration. One tap, app reloads on new code.
- **Tier 2 — in-app APK download + install** covers what OTA cannot ship: new native modules, permission changes, SDK bumps.

**Tech stack:** Expo SDK 57 · React Native 0.86 · TypeScript (strict) · `expo-updates` · `expo-application` · `expo-intent-launcher` · `expo-file-system` · **EAS Update** (project already configured) · Node's built-in test runner

**Repo:** `~/Documents/GitHub/send2u` · branch `main` · HEAD `47d278f3`

---

## Corrections from v1 — read this first

I wrote v1 before checking EAS state. Four things changed the plan:

**1. EAS is already configured and already building working APKs.** `eas.json` exists with `development` / `preview` / `production` build profiles, and `app.json` carries `extra.eas.projectId = 8187f8e3-53d7-4796-bda9-37ce1b5244e5`. Build `e8c9ee55` finished green and produced a 103.4 MB installable APK, with `EXPO_PUBLIC_*` vars confirmed present inside `assets/index.android.bundle`. The `preview` profile is already `distribution: internal` + `buildType: apk` — which is exactly the "hand a friend an APK" path you described.

**Consequence:** D1 flips decisively to **EAS Update**. Self-hosting a Cloudflare Worker would mean reimplementing a service you have half-configured already.

**2. A documented gotcha that v1 walked straight into.** The `2026-09-17` changelog entry records:

> *future `app.json` changes (`android`/`ios`/`icon`/`scheme`/`plugins`) will NOT reach the build because EAS skips prebuild sync when `android/` is present.*

`expo-updates` needs native configuration (`EXPO_UPDATE_URL`, `EXPO_RUNTIME_VERSION`, launch behaviour). If that config reaches the build only through the Expo config plugin running at prebuild time, then **adding `updates` to `app.json` would silently do nothing** and OTA would ship broken with no error. This is now the single highest-risk item in the plan and is gated behind D4 and a verification task.

**3. The version strategy in v1 conflicts with `appVersionSource: "remote"`.** `eas.json` sets `appVersionSource: "remote"` with `autoIncrement: true` on `production`. EAS therefore owns `versionCode` on EAS builds, while a local `./gradlew assembleRelease` still bakes the hardcoded `1`. Mixing the two produces downgrades, which Android refuses to install. See Risk 1.

**4. v1 said "no test suite".** Wrong — `npm test` runs 43 passing tests via `node --test "lib/**/*.test.ts"`, added in `8cbd3d16`. It covers pure `lib/` logic only: no component, integration, or end-to-end tests. The repo's `README.md` still claims no suite exists, which is stale.

Also noted: `changelog.md` and `CHANGELOG.md` are byte-identical duplicates, both 178,333 bytes. The project skill specifies `changelog.md`.

---

## Decisions required before Task 1

### D1. OTA hosting — **EAS Update** (recommended, now clearly)

The EAS project exists and builds work. `eas update` needs one-time `eas update:configure`, then one command per release. No new account, no new infrastructure, no Worker to write or maintain.

The self-hosted Cloudflare route remains possible later; see Open Question 1 on whether the update URL can be overridden at runtime, which would make the choice reversible without another APK handoff.

### D2. Target ABIs

Confirmed: **both** your local APK (108 MB) and the EAS build (103.4 MB) currently ship all four ABIs, including `x86` and `x86_64` which are emulator-only and cannot run on a phone.

- **Drop x86 + x86_64 (recommended):** ~108 MB → ~65 MB on both local and EAS builds.
- **arm64-v8a only:** ~50 MB. Every phone from roughly 2016 onward is arm64. Best if you know your friend's device.

### D3. Startup check behaviour

- **Silent check, prompt only when an update exists (recommended).**
- **Silent check, never auto-prompt** — Settings button only.
- **Auto-apply OTA silently + `reloadAsync()`** — fastest, but restarts the app under the user. Risky for a delivery app where someone may be mid-order or mid-fulfilment.

### D4. CNG vs committed `android/` — **new, and it blocks Phase 3**

Your 2026-09-17 changelog already flags this as an unresolved decision, and `expo-updates` forces it:

- **Option A — keep `android/` committed and authoritative (less risk).** Then any native config must be applied by hand to `android/app/src/main/AndroidManifest.xml` and `android/app/build.gradle`. No prebuild, no risk of losing hand-edits, but you carry the config manually forever.
- **Option B — add `/android` to `.gitignore` and let EAS prebuild from `app.json` (cleaner long-term).** Config plugins work as documented and `app.json` becomes the single source of truth. Cost: the committed native tree is discarded, including any hand-edits, and the first prebuild is a real migration.

**I lean Option A for now** — this feature is small, and Option B is a separate migration that deserves its own plan. But this is your call and it determines Tasks 3.2 and 3.3 entirely.

---

## Current state — verified 2026-09-19

- HEAD `47d278f3`, branch `main`, working tree clean except untracked `.hermes/`
- `versionCode 1` / `versionName "1.0.0"` hardcoded in `android/app/build.gradle:95-96`; `app.json` `version: "1.0.0"`; no `android.versionCode`
- `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` (`android/gradle.properties:31`)
- `expo-updates`, `expo-application`, `expo-intent-launcher` **not installed**
- `expo-file-system` installed; `expo.modules.filesystem.FileSystemFileProvider` already registered in the merged manifest → **no FileProvider work needed** for Tier 2
- `REQUEST_INSTALL_PACKAGES` **absent** from `android/app/src/main/AndroidManifest.xml`
- `android/app/debug.keystore` **is tracked in git** (un-ignored in `a49fcffd`) → keystore-loss risk is much lower than v1 assumed
- APK signer SHA-256 `fac61745…033b9c` matches the tracked keystore
- Test suite: `npm test` → 43 passing, 5 files, pure `lib/` logic
- Settings `app/(requester)/settings.tsx` has an "About" group with an App Version row
- 46 GB free on `/System/Volumes/Data`
- `eas.json`: `appVersionSource: "remote"`; `preview` = internal + APK; `production` = `autoIncrement: true` with **no `EXPO_PUBLIC_*` vars** (a production build would ship unconfigured — pre-existing, out of scope)

---

## Phase 0 — Decisions and one verification (no code)

**Task 0.1 — Resolve D1–D4.** No work starts before these.

**Task 0.2 — Verify how `expo-updates` config reaches a non-CNG Android build.** *(blocking)*

This determines whether Phase 3 is a config change or a manual native edit.

**Step 1:** Install the library:

```bash
npx expo install expo-updates
```

**Step 2:** Inspect whether the gradle plugin injects config at build time (which would make D4 = Option A viable):

```bash
find node_modules/expo-updates/android -name "*.gradle"
grep -rn "EXPO_UPDATE_URL\|EXPO_RUNTIME_VERSION\|EXUpdatesEnabled" node_modules/expo-updates/android
```

**Step 3:** If the plugin reads `app.json` during the Android build, Option A is fine and `app.json` works as documented. If it does not, Option A requires hand-writing the `<meta-data>` entries into `android/app/src/main/AndroidManifest.xml`.

**Step 4:** Confirm against the built artifact before trusting it:

```bash
unzip -p android/app/build/outputs/apk/release/app-release.apk AndroidManifest.xml > /tmp/am.bin
# decode with aapt2, then grep for EXUpdates
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump xmltree --file AndroidManifest.xml \
  android/app/build/outputs/apk/release/app-release.apk | grep -i "EXUpdates\|UPDATE_URL"
```

Expected after a successful build: `expo.modules.updates.EXPO_UPDATE_URL` present with your URL. Absent means OTA will never work and the plan must switch to Option B.

---

## Phase 1 — Reduce APK size

Independently valuable regardless of the update system, and it makes the one-time handoff much lighter.

**Task 1.1 — Restrict target ABIs**

**Files:** modify `android/gradle.properties:31`

**Step 1:** Confirm the current value:

```bash
grep -n "reactNativeArchitectures" android/gradle.properties
```
Expected: `31:reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`

**Step 2:** Change to (D2 = drop x86)

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

or (D2 = arm64-only)

```properties
reactNativeArchitectures=arm64-v8a
```

**Step 3:** This reaches EAS builds — `gradle.properties` is tracked and not gitignored, so the upload filter keeps it.

**Step 4:** Build and verify. See Task 6.3 for the toolchain setup.

```bash
unzip -l android/app/build/outputs/apk/release/app-release.apk | grep -oE "lib/[a-z0-9_-]+/" | sort -u
```
Expected: no `lib/x86/`, no `lib/x86_64/`

**Step 5:** Verify the signature did not change:

```bash
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk | grep SHA-256
```
Expected: still `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. If it changed, stop — your friend would have to uninstall.

---

## Phase 2 — Version discipline (reworked for `appVersionSource: "remote"`)

**Task 2.1 — Establish one version authority**

The problem: `eas.json` sets `appVersionSource: "remote"`, so EAS assigns `versionCode` server-side and `autoIncrement: true` bumps it per production build. A local `./gradlew assembleRelease` ignores that and bakes the hardcoded `1`. Install a local build over an EAS build and Android treats it as a **downgrade** and refuses.

**Files:** modify `eas.json`, `android/app/build.gradle`, `README.md`

**Step 1:** Pick one distribution path and record it. Recommended: **EAS `preview` builds become the only source of APKs you hand out.** Local Gradle builds are for smoke-testing only and never leave your machine. This removes the collision entirely.

**Step 2:** Add explicit auto-increment to the `preview` profile in `eas.json` so every test build gets a fresh `versionCode`:

```json
"preview": {
  "distribution": "internal",
  "autoIncrement": true,
  "android": { "buildType": "apk" }
}
```

**Step 3:** Document in `README.md` under a new "Releasing an update" section:

> APKs are produced by `eas build -p android --profile preview`. Never hand out a local `./gradlew assembleRelease` artifact — local builds bake a fixed `versionCode` and will be rejected as a downgrade against EAS-built installs.

**Step 4:** Confirm EAS remote versions are readable:

```bash
npx eas-cli build:version:get -p android
```
Expected: current remote `versionCode`.

---

**Task 2.2 — Read the installed native build version in-app**

**Files:** create `lib/appVersion.ts`

```ts
import * as Application from 'expo-application';

/**
 * The installed NATIVE build identity — the honest source for update checks.
 * `Constants.expoConfig.version` reflects the JS bundle, which an OTA update
 * replaces; the native build version is what Android compares when installing.
 */
export function getInstalledVersionCode(): number {
  const parsed = Number.parseInt(Application.nativeBuildVersion ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function getInstalledVersionName(): string {
  return Application.nativeApplicationVersion ?? '—';
}
```

**Step 1:** `npx expo install expo-application`
**Step 2:** `npx tsc --noEmit` → expect pass.

---

## Phase 3 — Tier 1: OTA updates

**Task 3.1 — Manifest parsing and update decision (pure logic, TDD)**

This is the highest-risk correctness surface in the feature: it interprets untrusted JSON fetched over the network. Pure, isolated, tested first.

**Files:** create `lib/releaseManifest.ts`, `lib/releaseManifest.test.ts`

**Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideUpdate, parseReleaseManifest, type ReleaseManifest } from './releaseManifest.ts';

const base: ReleaseManifest = {
  versionCode: 2,
  versionName: '1.0.1',
  minSupportedVersionCode: 1,
  apkUrl: 'https://example.com/send2u.apk',
  notes: 'Fixed the helper job queue.',
  mandatory: false,
};

test('parseReleaseManifest accepts a well-formed document', () => {
  assert.deepEqual(parseReleaseManifest({ ...base }), base);
});

test('parseReleaseManifest rejects malformed input', () => {
  const bad: unknown[] = [
    null, undefined, 'string', 42, [], {},
    { versionCode: 0 }, { versionCode: -1 }, { versionCode: 1.5 }, { versionCode: '2' },
  ];
  for (const input of bad) {
    assert.equal(parseReleaseManifest(input), null, `should reject ${JSON.stringify(input)}`);
  }
});

test('parseReleaseManifest sanitises optional fields', () => {
  const parsed = parseReleaseManifest({ versionCode: 3 });
  assert.ok(parsed);
  assert.equal(parsed.minSupportedVersionCode, 1);
  assert.equal(parsed.apkUrl, null);
  assert.equal(parsed.notes, '');
  assert.equal(parsed.mandatory, false);
  assert.equal(parsed.versionName, '3');
});

test('parseReleaseManifest rejects a non-https apkUrl', () => {
  const parsed = parseReleaseManifest({ versionCode: 3, apkUrl: 'http://insecure.example.com/a.apk' });
  assert.ok(parsed);
  assert.equal(parsed.apkUrl, null);
});

test('decideUpdate returns none when up to date or ahead', () => {
  assert.deepEqual(decideUpdate(2, base), { action: 'none' });
  assert.deepEqual(decideUpdate(5, base), { action: 'none' });
});

test('decideUpdate returns optional and mandatory correctly', () => {
  assert.deepEqual(decideUpdate(1, base), { action: 'optional', manifest: base });
  assert.deepEqual(
    decideUpdate(1, { ...base, mandatory: true }),
    { action: 'mandatory', manifest: { ...base, mandatory: true } },
  );
});

test('decideUpdate returns unsupported below the minimum supported build', () => {
  const m = { ...base, versionCode: 9, minSupportedVersionCode: 5 };
  assert.deepEqual(decideUpdate(1, m), { action: 'unsupported', manifest: m });
});
```

**Step 2:** `npm test` → Expected: FAIL, cannot find module `./releaseManifest.ts`

**Step 3: Write the implementation**

```ts
/**
 * Release manifest — the document published alongside each APK.
 * Fetched over the network, so every field is treated as untrusted.
 */
export interface ReleaseManifest {
  versionCode: number;
  versionName: string;
  minSupportedVersionCode: number;
  apkUrl: string | null;
  notes: string;
  mandatory: boolean;
}

export type UpdateDecision =
  | { action: 'none' }
  | { action: 'optional'; manifest: ReleaseManifest }
  | { action: 'mandatory'; manifest: ReleaseManifest }
  | { action: 'unsupported'; manifest: ReleaseManifest };

const MAX_NOTES = 2000;

/** Returns null for anything that is not a usable manifest. Never throws. */
export function parseReleaseManifest(input: unknown): ReleaseManifest | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;

  const versionCode = o.versionCode;
  if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) {
    return null;
  }

  const minRaw = o.minSupportedVersionCode;
  const minSupportedVersionCode =
    typeof minRaw === 'number' && Number.isInteger(minRaw) && minRaw >= 1 ? minRaw : 1;

  const apkRaw = o.apkUrl;
  const apkUrl = typeof apkRaw === 'string' && apkRaw.startsWith('https://') ? apkRaw : null;

  const notesRaw = o.notes;
  const notes = typeof notesRaw === 'string' ? notesRaw.trim().slice(0, MAX_NOTES) : '';

  const versionName =
    typeof o.versionName === 'string' && o.versionName.trim() !== ''
      ? o.versionName.trim()
      : String(versionCode);

  return {
    versionCode,
    versionName,
    minSupportedVersionCode,
    apkUrl,
    notes,
    mandatory: o.mandatory === true,
  };
}

/** Pure decision — no I/O, no side effects. */
export function decideUpdate(currentVersionCode: number, manifest: ReleaseManifest): UpdateDecision {
  if (currentVersionCode < manifest.minSupportedVersionCode) {
    return { action: 'unsupported', manifest };
  }
  if (manifest.versionCode > currentVersionCode) {
    return { action: manifest.mandatory ? 'mandatory' : 'optional', manifest };
  }
  return { action: 'none' };
}
```

**Step 4:** `npm test` → Expected: PASS, 43 existing + 7 new = 50 tests

**Step 5:** Commit

```bash
git add lib/releaseManifest.ts lib/releaseManifest.test.ts
git commit -m "feat(updates): release manifest parsing and update decision"
```

---

**Task 3.2 — Configure `expo-updates`** *(depends on Task 0.2 and D4)*

**Files:** modify `app.json`; modify `android/app/src/main/AndroidManifest.xml` **only if** Task 0.2 shows the gradle plugin does not inject config.

**Step 1:** Add to `app.json` `expo`:

```json
"runtimeVersion": { "policy": "fingerprint" },
"updates": {
  "enabled": true,
  "checkAutomatically": "NEVER",
  "fallbackToCacheTimeout": 0,
  "url": "https://u.expo.dev/8187f8e3-53d7-4796-bda9-37ce1b5244e5"
}
```

Two deliberate choices:

- **`checkAutomatically: "NEVER"`** — updates happen when your friend taps, not at unpredictable moments.
- **`policy: "fingerprint"`** — the runtime version is computed from the native project. When you add a native module or bump the SDK, the fingerprint changes, the OTA is correctly rejected, and the app falls through to the Tier 2 APK path. With a manually pinned runtime version, a missed bump ships JS calling native code the installed APK lacks, which crashes on launch. This is the most important safety setting in the feature.

**Step 2:** If D4 = Option A and Task 0.2 shows the plugin does not run, add the `<meta-data>` entries under `<application>` in `android/app/src/main/AndroidManifest.xml` by hand, matching whatever the plugin would have written.

**Step 3:** `npx expo-doctor` → expected 20/21 (the non-CNG warning is pre-existing)

**Step 4:** `npx eas-cli update:configure` if EAS Update has not been initialised for this project.

---

**Task 3.3 — OTA client wrapper**

**Files:** create `lib/otaUpdates.ts`

```ts
import * as Updates from 'expo-updates';

export type OtaResult =
  | { status: 'unsupported' }
  | { status: 'current' }
  | { status: 'downloaded' }
  | { status: 'error'; message: string };

/** OTA is unavailable in Expo Go and in development builds. */
export function isOtaAvailable(): boolean {
  return Updates.isEnabled && !Updates.isInExpoGo();
}

export async function checkAndDownloadOta(): Promise<OtaResult> {
  if (!isOtaAvailable()) return { status: 'unsupported' };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { status: 'current' };
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return { status: 'current' };
    return { status: 'downloaded' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Update check failed',
    };
  }
}

/** Relaunches into the downloaded bundle. Call only after `downloaded`. */
export async function applyOta(): Promise<void> {
  await Updates.reloadAsync();
}
```

**Step 1:** `npx tsc --noEmit` → expect pass
**Step 2:** Verify `Updates.isInExpoGo` exists in SDK 57; drop the clause if not (see Open Question 2).

---

**Task 3.4 — Publish an OTA** (D1 = EAS Update)

```bash
npx eas-cli update --branch preview --message "describe the change"
```

Use `preview` to match the build profile your friend installs from — an `eas update` published to a branch the installed build does not subscribe to will never be seen. `eas.json`'s `preview` profile declares no explicit `environment`, so EAS uses the profile name as the environment for env vars; keep OTA branch and build profile aligned.

---

## Phase 4 — Tier 2: in-app APK install

**Task 4.1 — Declare the install permission**

**Files:** modify `android/app/src/main/AndroidManifest.xml`

Add alongside the existing `uses-permission` entries:

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

Necessary but not sufficient: on Android 8+ the user must also grant "Install unknown apps" for Send2U, once. Task 4.3 handles that.

---

**Task 4.2 — APK download and installer handoff**

**Files:** create `lib/apkUpdate.ts`

```ts
import * as FileSystem from 'expo-file-system/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

export type ApkInstallResult =
  | { status: 'installed' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const APK_DIR = 'updates';
const MIME_APK = 'application/vnd.android.package-archive';
const ACTION_VIEW = 'android.intent.action.VIEW';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Downloads the APK into cache and hands it to the Android package installer.
 *
 * Android ALWAYS shows a system confirmation dialog before installing. That is
 * a platform security boundary and cannot be suppressed without root or MDM
 * device ownership. Callers should expect one extra user tap.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (fraction: number | null) => void,
): Promise<ApkInstallResult> {
  try {
    const dir = new Directory(Paths.cache, APK_DIR);
    if (!dir.exists) dir.create({ intermediates: true });

    const target = new File(dir, 'send2u-update.apk');
    if (target.exists) target.delete();

    const downloaded = await File.downloadFileAsync(apkUrl, dir);
    onProgress?.(1);

    // Android 7+ forbids file:// URIs in intents — must hand over content://.
    const contentUri = await FileSystem.getContentUriAsync(downloaded.uri);

    const result = await IntentLauncher.startActivityAsync(ACTION_VIEW, {
      data: contentUri,
      type: MIME_APK,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });

    return result.resultCode === IntentLauncher.ResultCode.Success
      ? { status: 'installed' }
      : { status: 'cancelled' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Install failed',
    };
  }
}

/** Sends the user to the per-app "Install unknown apps" screen. */
export async function openUnknownSourcesSettings(packageName: string): Promise<void> {
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
    data: `package:${packageName}`,
  });
}
```

**Step 1:** `npx expo install expo-intent-launcher`
**Step 2:** `npx tsc --noEmit`

**Step 3: Add progress reporting only if the API supports it.** The SDK 57 docs show `File.downloadFileAsync(url, destination)` without a progress callback. A 65 MB download with no feedback looks broken, so verify the signature before shipping:

```bash
grep -n "downloadFileAsync" node_modules/expo-file-system/src/*.ts node_modules/expo-file-system/build/*.d.ts
```
If no callback exists, fall back to `expo/fetch` streaming with a manual read loop, or show an indeterminate spinner and a plain "Downloading…" label.

**Step 4:** Confirm `getContentUriAsync` resolves from `expo-file-system/legacy` — it is documented but deprecated, and the docs warn the non-legacy namespace version throws at runtime.

---

**Task 4.3 — Manifest fetch service**

**Files:** create `lib/releaseService.ts`; modify `.env.example`

```ts
import { getInstalledVersionCode } from '@/lib/appVersion';
import { decideUpdate, parseReleaseManifest, type UpdateDecision } from '@/lib/releaseManifest';

const MANIFEST_URL = process.env.EXPO_PUBLIC_SEND2U_RELEASE_MANIFEST_URL ?? '';
const TIMEOUT_MS = 8000;

export async function fetchUpdateDecision(): Promise<UpdateDecision | null> {
  if (!MANIFEST_URL) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(MANIFEST_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!response.ok) return null;
    const manifest = parseReleaseManifest(await response.json());
    if (!manifest) return null;
    return decideUpdate(getInstalledVersionCode(), manifest);
  } catch {
    // Update checks must never surface an error to the user.
    return null;
  }
}
```

Add to `.env.example`:

```
# Public URL of the release manifest JSON
EXPO_PUBLIC_SEND2U_RELEASE_MANIFEST_URL=""
```

**Step 1:** Push it to EAS, using the correct **environment** (not branch) name:

```bash
npx eas-cli env:set --name EXPO_PUBLIC_SEND2U_RELEASE_MANIFEST_URL \
  --value "https://..." --environment preview --visibility plaintext
```

This step is not optional. Your own changelog records the same class of failure: the first green build produced an installable APK with no `EXPO_PUBLIC_*` values, so every service threw "Supabase is not configured". A successful build is not a working app.

---

## Phase 5 — UI wiring

**Task 5.1 — Settings row**

**Files:** modify `app/(requester)/settings.tsx`

In the "About" card, above the App Version row:

```tsx
<ListRow
  icon="system-update"
  title="Check for Updates"
  right={<Value>{updateRowValue}</Value>}
  accessibilityLabel={`Check for updates. ${updateRowValue}`}
  onPress={handleCheckForUpdates}
/>
```

`updateRowValue` is `'Checking…' | 'Up to date' | 'Update available' | 'Unavailable'` from local state. Follow the file's existing conventions: `ListRow` from `@/components/ui/ListRow`, `MaterialIcons` names only, tokens from `@/constants/theme`, no shadows, and wrap in `<View style={styles.divider}>` unless it is the last row.

The row must distinguish **"up to date"** from **"update check unavailable"**. With `policy: 'fingerprint'`, unrelated native churn can change the fingerprint and silently disable OTA. A channel that looks healthy while being dead is worse than one that reports it is broken.

---

**Task 5.2 — Update dialog**

**Files:** create `components/UpdatePrompt.tsx`

Behaviour by `UpdateDecision`:

- `none` → no UI; the Settings row reads "Up to date"
- `optional` → version, notes, `Update` / `Later`. OTA if available, otherwise APK download with progress
- `mandatory` → same, no `Later`, dismissal blocked
- `unsupported` → explain a full reinstall is needed, plus an `Open installer settings` action calling `openUnknownSourcesSettings`

The only existing production dialog pattern is `Alert.alert` (`app/(vendor)/menu.tsx`). Progress needs an in-app overlay, so build a stateful component following `DevProfileSwitcher`'s structure and reusing `components/ui/Card`, `Button`, `Text`.

---

**Task 5.3 — Launch check**

**Files:** modify `app/_layout.tsx`

If D3 = silent check with prompt: after the auth gate resolves, call `fetchUpdateDecision()` once per launch and render `UpdatePrompt` when the action is not `none`.

Guard against running before the session is ready, re-running on every re-render (use a ref for a single launch check), and firing while the user is mid-order. The auth gate already holds routing behind a loading screen until profile lookup completes — hook in after that, not before.

---

## Phase 6 — Validation and changelog

**Task 6.1 — Full validation loop** (mandatory per the project skill)

```bash
npm test
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export -p web --clear
```
Expected: 50 tests pass · tsc clean · lint exit 0 · doctor 20/21 · web export succeeds

**Task 6.2 — Append to `changelog.md`** (not `CHANGELOG.md`; they are duplicates today, but the skill names `changelog.md`)

```md
## 2026-09-19 — Updates: in-app update system (OTA + APK fallback)

- Change: added a two-tier in-app update system so sideloaded installs can
  update without app stores. `expo-updates` for JS/assets, plus an in-app
  APK download-and-install path via `expo-intent-launcher` for native changes.
- Reason: testers receive APKs directly; manual re-handoff does not scale.
- Details: `lib/releaseManifest.ts` (pure manifest parsing + update decision,
  tested), `lib/appVersion.ts` (native build version), `lib/otaUpdates.ts`,
  `lib/apkUpdate.ts`, `lib/releaseService.ts`, `components/UpdatePrompt.tsx`;
  Settings gains a "Check for Updates" row. `app.json` gains
  `runtimeVersion: { policy: 'fingerprint' }` and
  `updates.checkAutomatically: 'NEVER'`. `REQUEST_INSTALL_PACKAGES` declared.
  Release ABIs restricted to arm64-v8a + armeabi-v7a, cutting the EAS APK from
  103.4 MB to ~62 MB. `eas.json` preview profile gains `autoIncrement: true`.
  New env var `EXPO_PUBLIC_SEND2U_RELEASE_MANIFEST_URL` pushed to the preview
  environment.
- Validation: <fill in actual results>
- Known limitations: Android always shows a system confirmation dialog before
  installing an APK; it cannot be suppressed without root or MDM. On-device
  verification of the install path is still pending.
```

**Task 6.3 — Build and hand off**

Local build toolchain (no `android/local.properties` on this machine, per the project skill):

```bash
cd ~/Documents/GitHub/send2u
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
df -h /System/Volumes/Data        # confirm >= 5 GB free
cd android && ./gradlew assembleRelease
```

But per Task 2.1, the artifact you **hand over** comes from EAS:

```bash
npx eas-cli build -p android --profile preview
```

Then verify the signature before passing it on:

```bash
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs <downloaded>.apk
```
Expected: valid, SHA-256 `fac61745…033b9c`

---

## Files likely to change

**Create**
- `lib/releaseManifest.ts`, `lib/releaseManifest.test.ts`
- `lib/appVersion.ts`, `lib/otaUpdates.ts`, `lib/apkUpdate.ts`, `lib/releaseService.ts`
- `components/UpdatePrompt.tsx`

**Modify**
- `app.json` — `runtimeVersion`, `updates`
- `eas.json` — `preview.autoIncrement`
- `.env.example` — manifest URL
- `android/gradle.properties` — ABI list
- `android/app/src/main/AndroidManifest.xml` — `REQUEST_INSTALL_PACKAGES` (+ `<meta-data>` if D4 = Option A and Task 0.2 requires it)
- `app/(requester)/settings.tsx` — Check for Updates row
- `app/_layout.tsx` — launch check
- `README.md` — "Releasing an update"
- `changelog.md` — new entry

**Not changed:** `services/`, `types/domain.ts`, any Supabase schema or RPC, the order lifecycle, the settlement ledger, or anything in the requester/helper/vendor order flows. This feature is purely additive and touches no existing state machine.

---

## Risks

**1. Local vs EAS `versionCode` collision — most likely to bite.** `appVersionSource: "remote"` means EAS versions advance independently of the hardcoded `1` in `build.gradle`. Installing a local build over an EAS build is a downgrade, which Android refuses with an opaque "App not installed". Mitigation is Task 2.1: one distribution path only.

**2. `app.json` config may not reach a non-CNG Android build.** Your own changelog documents that EAS skips prebuild sync when `android/` is present. If `expo-updates` config only reaches the build through prebuild, OTA ships silently broken. Gated behind Task 0.2 — **do not skip it.**

**3. Fingerprint drift disables OTA silently.** Unrelated native churn changes the fingerprint, OTA is correctly rejected, and nothing tells you. Mitigation: the Settings row must surface "unavailable" as a distinct state from "up to date".

**4. Download progress API uncertainty.** `File.downloadFileAsync`'s options shape and progress callback are unconfirmed for SDK 57. A 62 MB silent download looks broken. Verify in Task 4.2 before wiring the progress UI.

**5. `getContentUriAsync` is deprecated.** It works but sits on a deprecated path. Add a comment; if a future SDK removes it, Tier 2 needs a custom FileProvider.

**6. Chicken-and-egg, unavoidable.** Your friend's current APK contains no update mechanism, so they install **one more APK by hand**. OTA cannot retroactively reach an app without `expo-updates` inside it. Mitigation: Phase 1 makes that handoff ~62 MB instead of ~103 MB.

**7. `runtimeVersion` mismatch on the first OTA.** The APK you hand over must be built *with* the new `runtimeVersion` config. Publishing an OTA before your friend installs the new APK does nothing.

**8. OTA branch must match the build profile.** Publishing to `production` while the installed build subscribes to `preview` means the update is never seen, with no error anywhere.

---

## Open questions

1. **Does `Updates.setUpdateURLAndRequestHeadersOverride()` exist in SDK 57?** If yes, the update host becomes changeable without rebuilding the APK, which keeps the door open to self-hosting later. Worth checking before committing to EAS-only.
2. **Is `Updates.isInExpoGo` present in SDK 57?** Affects `lib/otaUpdates.ts` as written.
3. **Which ABIs does your friend's phone need?** Getting the model lets us go arm64-only for another ~15 MB.
4. **Where does the manifest live?** A public R2 bucket (you have one working) or a small Worker endpoint. Either is fine; decide before Task 4.3.
5. **`production` has no `EXPO_PUBLIC_*` vars.** Your changelog flags this. Out of scope here, but if you ever build `production`, it will ship unconfigured unless fixed.

---

## Handoff

Order: D1–D4 → **Task 0.2 verification** → Phase 1 (size) → Phase 2 (version discipline) → Phase 3 (OTA) → Phase 4 (APK fallback) → Phase 5 (UI) → Phase 6 (validate, changelog, build).

Phases 1 and 2 are self-contained and worth doing regardless. Phase 3 delivers the one-tap experience you asked for. Phase 4 is insurance for native changes. Task 0.2 is small and gates the riskiest assumption — run it first.

Every phase ends with the project's mandatory validation loop and a changelog entry, per the `send2u-dev` skill.
