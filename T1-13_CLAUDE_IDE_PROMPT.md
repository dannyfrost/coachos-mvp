# T1-13 — Expo Mobile Scaffold + Client Activation Screen
## Claude IDE Implementation Prompt

---

## Pre-flight

```bash
git status
git log --oneline -5
```

Expected: clean working tree. Latest commit is T1-12 (coach client list screen).

Also confirm:
```bash
find apps/mobile -type f
```
Expected: only `apps/mobile/.gitkeep`. If any other files exist, stop and report before proceeding.

---

## Context

You are continuing the Coaching Platform MVP monorepo (pnpm + Turborepo).

- Web app: `apps/web` (Next.js 14 App Router) — **do not modify any web files**
- Mobile app: `apps/mobile` (currently empty — only `.gitkeep`) — **build this**
- Shared Supabase package: `packages/supabase` — add `mobile.ts` export only

**What this task builds:**
1. Full Expo SDK ~52 scaffold in `apps/mobile/`
2. Client Activation screen — token entry → password setup → calls `POST /api/client-activation/complete` → stores session → navigates to Home
3. Minimal Home placeholder screen (no features — daily logging comes in T1-14)

**Depends on:** T1-07 complete — `apps/web/app/api/client-activation/complete/route.ts` exists.

---

## Step 1 — Verify activation API contract (read-only)

Read `apps/web/app/api/client-activation/complete/route.ts`.

Confirm **exactly**:
- Method: `POST`
- No auth header required
- Body: `{ token: string, password: string }` — `password` min 8 chars enforced by API
- Success **200** (not 201): `{ access_token: string, refresh_token: string, expires_in: number }`
- Error body: `{ error: string }` — status codes: 400, 401, 403, 409, 422, 500

If anything does not match, **stop and report the mismatch. Do not modify the API route.**

---

## Step 2 — Add mobile.ts to packages/supabase

**2a. Create `packages/supabase/mobile.ts`:**

```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './database.types';

export function createMobileSupabaseClient() {
  return createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  );
}
```

**2b. Update `packages/supabase/package.json`:**

Add `"./mobile": "./mobile.ts"` to the `exports` map and add `@react-native-async-storage/async-storage` as an optional peer dependency. The final file:

```json
{
  "name": "@coaching/supabase",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./client": "./client.ts",
    "./server": "./server.ts",
    "./auth-server": "./auth-server.ts",
    "./browser": "./browser.ts",
    "./ssr-server": "./ssr-server.ts",
    "./mobile": "./mobile.ts"
  },
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2"
  },
  "peerDependencies": {
    "@react-native-async-storage/async-storage": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@react-native-async-storage/async-storage": {
      "optional": true
    }
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

---

## Step 3 — Create apps/mobile scaffold files

Create each file below exactly as written.

---

### `apps/mobile/package.json`

```json
{
  "name": "@coaching/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@coaching/supabase": "workspace:*",
    "@react-native-async-storage/async-storage": "1.23.1",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.2",
    "react-native": "0.76.6",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "babel-preset-expo": "~12.0.0",
    "typescript": "^5.3.0"
  }
}
```

> After creating this file, run `pnpm install` from the repo root. If any version causes a peer conflict, use `npx expo install <package>` from within `apps/mobile/` to resolve to the Expo-compatible version.

---

### `apps/mobile/app.json`

```json
{
  "expo": {
    "name": "Coaching",
    "slug": "coaching-mobile",
    "version": "1.0.0",
    "scheme": "coachapp",
    "platforms": ["ios", "android"],
    "sdkVersion": "52.0.0",
    "orientation": "portrait",
    "plugins": [
      "expo-router"
    ],
    "ios": {
      "supportsTablet": false
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

---

### `apps/mobile/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "jsxImportSource": "react"
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.d.ts",
    "expo-env.d.ts"
  ]
}
```

---

### `apps/mobile/babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

---

### `apps/mobile/.env.example`

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 4 — Create app screens

---

### `apps/mobile/app/_layout.tsx` (root layout)

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

---

### `apps/mobile/app/index.tsx` (session gate)

```tsx
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    createMobileSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(!!data.session);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return hasSession ? (
    <Redirect href="/(client)/home" />
  ) : (
    <Redirect href="/activate" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
```

---

### `apps/mobile/app/activate.tsx` (activation screen)

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

function getErrorMessage(status: number, json: { error?: string }): string {
  switch (status) {
    case 400:
      return json.error ?? 'Token and password are required.';
    case 401:
      return 'Invalid or expired activation token. Ask your coach to re-invite you.';
    case 403:
      return 'Your account is not available. Please contact your coach.';
    case 409:
      return 'This account is already activated. Please log in instead.';
    case 422:
      return 'Password not accepted. Try a stronger password.';
    default:
      return 'Something went wrong. Check your connection and try again.';
  }
}

export default function ActivateScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setError(null);

    if (!token.trim()) {
      setError('Activation token is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/client-activation/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const json = await res.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };

      if (!res.ok) {
        setError(getErrorMessage(res.status, json));
        return;
      }

      const supabase = createMobileSupabaseClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.access_token!,
        refresh_token: json.refresh_token!,
      });

      if (sessionError) {
        setError('Activation complete but could not sign in. Please try again.');
        return;
      }

      router.replace('/(client)/home');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Activate Your Account</Text>
        <Text style={styles.subtitle}>
          Enter the activation token your coach shared with you, then set a password.
        </Text>

        <Text style={styles.label}>Activation Token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Paste your activation token"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          returnKeyType="next"
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter password"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleActivate}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleActivate}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Activate account"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Activating…' : 'Activate Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

### `apps/mobile/app/(client)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';

export default function ClientLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

### `apps/mobile/app/(client)/home.tsx`

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Daily logging — coming in T1-14.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
```

---

## Step 5 — Install dependencies

From the repo root:

```bash
pnpm install
```

If peer conflicts appear for any package, resolve with:

```bash
cd apps/mobile && npx expo install <conflicting-package>
```

Accept Expo-recommended versions. Do not downgrade `@supabase/supabase-js`.

---

## Step 6 — TypeScript check

```bash
pnpm --filter @coaching/mobile exec tsc --noEmit
```

Zero errors required. Common issues and fixes:

- `Cannot find module '@coaching/supabase/mobile'` — confirm `packages/supabase/package.json` exports map includes `"./mobile": "./mobile.ts"` and run `pnpm install` again
- `Cannot find module '@react-native-async-storage/async-storage'` — confirm it is in `apps/mobile/package.json` dependencies and `pnpm install` ran
- `process.env` type errors — add `/// <reference types="expo-constants" />` at top of the failing file
- `useLocalSearchParams` generic not accepted — remove the type parameter: `const params = useLocalSearchParams()`
- Type conflicts from `database.types.ts` — do not modify it; cast as needed

**Do not modify `packages/supabase/database.types.ts` under any circumstance.**

---

## Step 7 — Start Metro bundler

```bash
pnpm dev:mobile
```

Metro must start without crashing. Expected output: QR code + `Metro waiting on exp://...`

If Metro fails:
1. Check `apps/mobile/babel.config.js` exists and uses `babel-preset-expo`
2. Check `apps/mobile/package.json` main field is `"expo-router/entry"`
3. Re-run `pnpm install`

Do not fix Metro errors by modifying web files or migrations.

---

## Step 8 — Runtime verification (Expo Go)

Scan the QR code with Expo Go on a physical device or simulator.

Verify:
1. App opens — no red error screen
2. Index redirects to `/activate` (no existing session)
3. Activation screen renders: title, three inputs, one button
4. Empty token + submit → "Activation token is required."
5. Short password + submit → "Password must be at least 8 characters."
6. Mismatched passwords → "Passwords do not match."

If local Next.js dev server is running on port 3000 and `.env.local` is configured:
7. Valid token + matching passwords → 200, session stored, navigates to Home ("Daily logging — coming in T1-14.")
8. Already-used token → 401 error message
9. Already-activated account token → 409 message

If local dev server not running, log: `Integration test skipped — local dev server not running.`

**Never point EXPO_PUBLIC_API_BASE_URL at the production URL during testing.**

---

## Step 9 — Update control documents

### `PROJECT_STATE.md`
- Mark T1-13 complete
- Update "Latest completed task" to T1-13
- Update "Next task" to T1-14

### `TASK_LOG.md`
- Append T1-13 entry: task ID, description, files created/modified, commit hash, date, result, deviations

### `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md`
- Update "Last completed" to T1-13
- Update "Next task" to T1-14
- Note any Expo/dependency version deviations discovered

---

## Step 10 — Commit

Delete `.gitkeep` and stage all new files:

```bash
rm apps/mobile/.gitkeep
git add packages/supabase/mobile.ts
git add packages/supabase/package.json
git add apps/mobile/package.json
git add apps/mobile/app.json
git add apps/mobile/tsconfig.json
git add apps/mobile/babel.config.js
git add "apps/mobile/.env.example"
git add "apps/mobile/app/_layout.tsx"
git add "apps/mobile/app/index.tsx"
git add "apps/mobile/app/activate.tsx"
git add "apps/mobile/app/(client)/_layout.tsx"
git add "apps/mobile/app/(client)/home.tsx"
git add PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

Stage any auto-generated Expo files if present:

```bash
git add apps/mobile/.expo/ 2>/dev/null || true
git add apps/mobile/expo-env.d.ts 2>/dev/null || true
```

Commit:

```bash
git commit -m "feat(mobile): scaffold Expo app + client activation screen + home placeholder (T1-13)"
```

Report the commit hash.

---

## Acceptance Criteria

- [ ] `pnpm install` completes without unresolved peer errors
- [ ] `pnpm --filter @coaching/mobile exec tsc --noEmit` → zero errors
- [ ] `pnpm dev:mobile` starts Metro without crashing
- [ ] App opens in Expo Go — no red screen
- [ ] Index routes to `/activate` (no session) or `/(client)/home` (has session)
- [ ] Activation screen renders three inputs (token, password, confirm) and button
- [ ] Client-side validation: empty token, short password, mismatched passwords each show correct inline error
- [ ] Per-status-code error messages displayed for 401, 403, 409, 422
- [ ] On 200: session stored via `setSession`, navigates to `/(client)/home`
- [ ] Home screen shows "Home" + "Daily logging — coming in T1-14." — no further features
- [ ] `apps/mobile/.gitkeep` deleted
- [ ] `packages/supabase/mobile.ts` created with `createMobileSupabaseClient()`
- [ ] `packages/supabase/package.json` exports map includes `./mobile`
- [ ] No web files modified
- [ ] No migrations, RLS, or `database.types.ts` modified
- [ ] Control docs updated
- [ ] Commit created

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/supabase/mobile.ts` | **Create** |
| `packages/supabase/package.json` | Modify — add `./mobile` export + optional peer dep |
| `apps/mobile/.gitkeep` | **Delete** |
| `apps/mobile/package.json` | **Create** |
| `apps/mobile/app.json` | **Create** |
| `apps/mobile/tsconfig.json` | **Create** |
| `apps/mobile/babel.config.js` | **Create** |
| `apps/mobile/.env.example` | **Create** |
| `apps/mobile/app/_layout.tsx` | **Create** |
| `apps/mobile/app/index.tsx` | **Create** |
| `apps/mobile/app/activate.tsx` | **Create** |
| `apps/mobile/app/(client)/_layout.tsx` | **Create** |
| `apps/mobile/app/(client)/home.tsx` | **Create** |
| `PROJECT_STATE.md` | Update |
| `TASK_LOG.md` | Append |
| `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` | Update |

## Files Explicitly NOT to Modify

- `supabase/migrations/*`
- RLS policies
- `packages/supabase/database.types.ts`
- `packages/supabase/client.ts`
- `packages/supabase/server.ts`
- `packages/supabase/auth-server.ts`
- `packages/supabase/browser.ts`
- `packages/supabase/ssr-server.ts`
- `apps/web/**` (entire web app)
- Root `package.json`
- Root `turbo.json`
