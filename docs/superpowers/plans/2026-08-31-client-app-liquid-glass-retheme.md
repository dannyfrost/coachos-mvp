# Client App Liquid-Glass Retheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the Expo client (mobile) app from its current "Iron Ledger" web-matching look to the "liquid glass" client design specified in `COACHOS.md`, and simplify the Home daily-log screen to match its new content order — without touching the coach web app.

**Architecture:** Token/typography/shape layer changes in `lib/design-system.tsx` ripple to every screen since all client screens already build from `T`, `Card`, `Btn`, `Badge`, `Avatar`. A new pure-logic module (`lib/mealBudget.ts`) adds the kcal-limit/sitting-budget behavior the current app has no equivalent of. Screen-by-screen tasks apply the retheme and, for Home only, restructure content order per spec. No backend/schema changes.

**Tech Stack:** Expo SDK 54, React Native, expo-router, TypeScript, Jest (jest-expo preset) for pure-function unit tests.

**Spec:** `C:\Users\hammd\Downloads\COACHOS.md` (Client app sections only — "Client app = liquid glass", "Client app — IA", "Home section order (after simplify)", "Meal (Home and Meals tab)", "Production retheme of the existing Expo app", "Screen checklist → Client", "Do / Don't"). **No `client.html`/`CLIENT-ROUTES.md`/`TOKENS.md` prototype files exist on this machine** — user confirmed to build from the written spec only, inventing nothing beyond it.

## Global Constraints

- Client app font: **Public Sans only.** Drop Inter and Manrope entirely from client screens (coach web is out of scope, untouched).
- Navy stays `#00488d` (T.primary) — **do not invent a new palette.** All other T token hex values are unchanged (verified identical to spec's "production map" list already in `lib/design-system.tsx`).
- Drop **pills** (Badge's `borderRadius:20`) and **gradient avatars** as brand chrome on the client app. Status = one underlined word. Avatar/initials = small navy mark, not a gradient stamp.
- Frosted round cards ~24px radius (current `Card` is 12px, opaque white, 1px border).
- Floating capsule tab bar (current tab bar is an opaque bottom bar with a sliding underline — different shape language).
- Background wash: "brighter morning light... peach + blue sky wash" — every client screen needs this background treatment, not `T.surface` flat fill.
- Four tabs only: Menu, Meals, My Progress, Settings. Do not add a fifth.
- Do not add water, sleep, recovery, or achievements/streak-as-a-product. The existing streak number on Progress is summary copy only — leave as-is, don't expand it.
- Meal cap `MEAL_CAP = 1850`. Sitting budgets: Breakfast `450`, Lunch `550`, Dinner `650`, Snack `200`.
- Today's-tasks checklist is **not tappable-to-check** — a box checks only after that field's value has actually been submitted. (Codebase already computes `done` this way via `todayLog`/`submitSuccess` — preserve this, don't regress it to tap-to-toggle.)
- Weight OCR is **one quiet "From photo" control**, not a visible Camera/Gallery button pair. (Reconciles with the gallery-pick fix already shipped: keep both capture paths, but surface them as one button that opens a native action sheet with "Take Photo" / "Choose from Library", not two side-by-side icons.)
- Task ids stay exactly: `weight`, `steps`, `meals`, `photo` (optional), `questions`. Don't invent more.

---

### Task 1: Design-system token, typography, and shape swap

**Files:**
- Modify: `apps/mobile/lib/design-system.tsx`
- Modify: `apps/mobile/package.json` (font package swap)
- Test: manual — run `expo start`, open any client screen, visually confirm font/shape (no unit test: these are style constants, not behavior)

**Interfaces:**
- Consumes: nothing (base layer)
- Produces: `T` (unchanged hex values, confirmed against spec), `fontFamily` (new keys pointing at Public Sans weights), `cardShadow` (unchanged), `Card` (24px radius, frosted/translucent), `Btn` (no pill radius change needed — buttons weren't pills), `Badge` deprecated in favor of new `StatusWord` export, `Avatar` reworked to a small flat navy mark, new `screenBackground` style (peach + blue sky wash) exported for screens to spread onto their root container.

- [ ] **Step 1: Swap font packages**

Remove `@expo-google-fonts/inter` and `@expo-google-fonts/manrope` from `apps/mobile/package.json` dependencies, add `@expo-google-fonts/public-sans`. Check the exact bundled version first:

```bash
cd apps/mobile && node -e "const b=require('expo/bundledNativeModules.json'); console.log(Object.keys(b).filter(k=>k.includes('font')))"
```

`@expo-google-fonts/*` packages aren't in `bundledNativeModules.json` (they're pure JS font-data packages, not native modules) — use the same major version pattern as the existing `@expo-google-fonts/inter": "^0.4.2"` entry: add `"@expo-google-fonts/public-sans": "^0.4.2"`.

- [ ] **Step 2: Update `fontFamily` export**

In `apps/mobile/lib/design-system.tsx`, replace:

```typescript
export const fontFamily = {
  headingBold: 'Manrope_700Bold',
  headingExtraBold: 'Manrope_800ExtraBold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};
```

with:

```typescript
export const fontFamily = {
  headingBold: 'PublicSans_700Bold',
  headingExtraBold: 'PublicSans_800ExtraBold',
  bodyRegular: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemiBold: 'PublicSans_600SemiBold',
  bodyBold: 'PublicSans_700Bold',
};
```

Public Sans ships 400/500/600/700/800 weights, matching the existing key shape one-for-one — no call site changes needed anywhere else in the app.

- [ ] **Step 3: Update the font loader**

Find where `useFonts` currently loads Inter/Manrope (search `expo-font` + `useFonts` in `app/_layout.tsx`), swap the imports from `@expo-google-fonts/inter` / `@expo-google-fonts/manrope` to `@expo-google-fonts/public-sans`, and load `PublicSans_400Regular, PublicSans_500Medium, PublicSans_600SemiBold, PublicSans_700Bold, PublicSans_800ExtraBold`.

- [ ] **Step 4: Add the background wash and frost the Card**

In `apps/mobile/lib/design-system.tsx`, add an exported wash background and update `Card`:

```typescript
export const screenBackground: ViewStyle = {
  flex: 1,
  backgroundColor: '#fdf6ee', // peach base
};

export const screenWashColors: [string, string] = ['#fdf1e4', '#e8f1fb']; // peach -> blue sky
```

Update the `card` style in `styles` (bottom of the file) from `borderRadius: 12` to `borderRadius: 24`, and lighten the fill toward translucency:

```typescript
card: {
  backgroundColor: 'rgba(255,255,255,0.72)',
  borderRadius: 24,
  padding: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.5)',
  ...cardShadow,
},
```

(True iOS/Android blur requires `expo-blur`, not currently a dependency — the translucent-white-over-wash approximation above is the "only fit what's real" call for this pass. If a stronger frost is wanted later, add `expo-blur`'s `<BlurView>` behind `Card` as a follow-up, not in this task.)

- [ ] **Step 5: Replace `Badge` pill-status usage with `StatusWord`**

Add a new export below `Badge` in `design-system.tsx` (keep `Badge`/`BADGE_MAP` — still used for non-status chips like "Meal"/"Workout"/alert levels per the Progress/Meals screens; the spec's "one underlined word" rule applies specifically to *client flash/health status*, not every colored chip):

```typescript
export function StatusWord({
  status,
  labelOverride,
  style,
}: {
  status: string;
  labelOverride?: string;
  style?: StyleProp<TextStyle>;
}) {
  const s = BADGE_MAP[status.toLowerCase()] || { text: T.muted, label: status };
  return (
    <Text
      style={[
        {
          fontFamily: fontFamily.bodySemiBold,
          fontWeight: '600',
          fontSize: 14,
          color: s.text,
          textDecorationLine: 'underline',
        },
        style,
      ]}
    >
      {labelOverride ?? s.label}
    </Text>
  );
}
```

- [ ] **Step 6: Replace gradient `Avatar` with a flat navy mark**

Replace the `Avatar` function body (currently a `LinearGradient` circle) with a flat navy square/round mark — small, not brand chrome:

```typescript
export function Avatar({
  initials,
  size = 36,
  style,
}: {
  initials: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: T.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: T.white,
          fontFamily: fontFamily.headingBold,
          fontWeight: '700',
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
```

Same signature as before (`initials`, `size`, `style`) — every call site (`home.tsx`, `settings.tsx`, `_layout.tsx`) keeps working unmodified. `LinearGradient` import in `design-system.tsx` can now be removed if the only remaining consumer was `Avatar` and the primary `Btn` variant — check `Btn`'s primary variant still uses it (it does, for the button gradient — keep that import, it's a different call site).

- [ ] **Step 7: Typecheck and visual smoke check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: zero errors (no call site changed shape, only values). Then `npx expo start`, open on a device/emulator, confirm any screen renders Public Sans text and a rounder, lighter card — full visual confirmation happens screen-by-screen in later tasks, this step is just "did the token layer break the build."

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/design-system.tsx apps/mobile/package.json apps/mobile/pnpm-lock.yaml apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): retheme design-system tokens to liquid-glass (Public Sans, frosted cards, flat avatar, status word)"
```

---

### Task 2: Meal budget pure-logic module (new feature, TDD)

**Files:**
- Create: `apps/mobile/lib/mealBudget.ts`
- Test: `apps/mobile/lib/__tests__/mealBudget.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no native/network deps — mirrors `stepsSync.ts`'s isolation pattern)
- Produces: `MEAL_CAP: number`, `MEAL_KCAL: Record<MealType, number>`, `MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'` (already defined in `meals.tsx` — this module becomes the source of truth, `meals.tsx`/`home.tsx` import it from here instead of redeclaring), `computeKcalLeft(loggedTypes: MealType[]): number`, `sittingSliceState(type: MealType, selected: MealType | null, logged: MealType[]): 'filled' | 'selected' | 'empty'`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/lib/__tests__/mealBudget.test.ts
import { MEAL_CAP, MEAL_KCAL, computeKcalLeft, sittingSliceState } from '../mealBudget';

describe('meal budget constants', () => {
  it('caps at 1850 with the four spec\'d sitting budgets', () => {
    expect(MEAL_CAP).toBe(1850);
    expect(MEAL_KCAL).toEqual({ breakfast: 450, lunch: 550, dinner: 650, snack: 200 });
  });
});

describe('computeKcalLeft', () => {
  it('returns the full cap when nothing is logged', () => {
    expect(computeKcalLeft([])).toBe(1850);
  });

  it('subtracts each logged sitting\'s budget', () => {
    expect(computeKcalLeft(['breakfast'])).toBe(1400);
    expect(computeKcalLeft(['breakfast', 'lunch'])).toBe(850);
  });

  it('never returns below zero even if all four are logged', () => {
    expect(computeKcalLeft(['breakfast', 'lunch', 'dinner', 'snack'])).toBe(0);
  });

  it('ignores duplicate entries for the same sitting', () => {
    expect(computeKcalLeft(['breakfast', 'breakfast'])).toBe(1400);
  });
});

describe('sittingSliceState', () => {
  it('is "filled" (navy) once that sitting is logged, regardless of selection', () => {
    expect(sittingSliceState('breakfast', null, ['breakfast'])).toBe('filled');
    expect(sittingSliceState('breakfast', 'lunch', ['breakfast'])).toBe('filled');
  });

  it('is "selected" (outlined "now") when picked but not yet logged', () => {
    expect(sittingSliceState('lunch', 'lunch', [])).toBe('selected');
  });

  it('is "empty" when neither selected nor logged', () => {
    expect(sittingSliceState('dinner', 'lunch', ['breakfast'])).toBe('empty');
  });

  it('prefers "filled" over "selected" when a sitting is both selected and already logged', () => {
    expect(sittingSliceState('snack', 'snack', ['snack'])).toBe('filled');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest lib/__tests__/mealBudget.test.ts
```

Expected: FAIL — `Cannot find module '../mealBudget'`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/mobile/lib/mealBudget.ts

/**
 * Pure meal-budget math for the Home "Today" panel and Meals tab.
 * No native/network/storage calls — same isolation pattern as stepsSync.ts.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_CAP = 1850;

export const MEAL_KCAL: Record<MealType, number> = {
  breakfast: 450,
  lunch: 550,
  dinner: 650,
  snack: 200,
};

export function computeKcalLeft(loggedTypes: MealType[]): number {
  const uniqueLogged = new Set(loggedTypes);
  const spent = Array.from(uniqueLogged).reduce((sum, t) => sum + MEAL_KCAL[t], 0);
  return Math.max(0, MEAL_CAP - spent);
}

export type SittingSliceState = 'filled' | 'selected' | 'empty';

export function sittingSliceState(
  type: MealType,
  selected: MealType | null,
  loggedTypes: MealType[]
): SittingSliceState {
  if (loggedTypes.includes(type)) return 'filled';
  if (selected === type) return 'selected';
  return 'empty';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest lib/__tests__/mealBudget.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/mealBudget.ts apps/mobile/lib/__tests__/mealBudget.test.ts
git commit -m "feat(mobile): add meal-budget pure logic (1850 kcal cap, per-sitting budgets)"
```

---

### Task 3: Home screen — simplify section order, wire meal budget, single "From photo" control

**Files:**
- Modify: `apps/mobile/app/(client)/home.tsx`
- Test: manual on-device — this task is UI composition over already-tested logic (Task 2's unit tests cover the math; `weightOcrState.test.ts` already covers OCR state transitions). No new pure logic is introduced here beyond what Task 2 covers.

**Interfaces:**
- Consumes: `MEAL_CAP`, `MEAL_KCAL`, `MealType`, `computeKcalLeft`, `sittingSliceState` from `../../lib/mealBudget`; `screenBackground`, `screenWashColors`, `StatusWord` from `../../lib/design-system` (Task 1)
- Produces: nothing further downstream (leaf screen)

- [ ] **Step 1: Replace the status banner with one underlined status word**

Find the current `statusBanner` block (colored paragraph banner under the greeting). Replace it with a single line: greeting/date, then `<StatusWord status={...} />` directly under it — no background-colored paragraph.

- [ ] **Step 2: Default "Today's tasks" to collapsed**

Change:
```typescript
const [collapsed, setCollapsed] = useState(false);
```
to:
```typescript
const [collapsed, setCollapsed] = useState(true);
```
Confirm the header still reads "Today's tasks" + "N remaining" + the `CompletionRing` — this part already matches spec, only the default state was wrong.

- [ ] **Step 3: Collapse the Weight OCR camera/gallery pair into one "From photo" control**

Replace the two side-by-side `TouchableOpacity` icon buttons (camera icon + gallery icon, added in the previous session) with one button that shows an action sheet:

```typescript
import { ActionSheetIOS, Alert, Platform } from 'react-native';

const handleFromPhotoPress = () => {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Take Photo', 'Choose from Library', 'Cancel'], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) handleWeightCameraPress();
        if (index === 1) handleWeightGalleryPress();
      }
    );
  } else {
    Alert.alert('From photo', undefined, [
      { text: 'Take Photo', onPress: handleWeightCameraPress },
      { text: 'Choose from Library', onPress: handleWeightGalleryPress },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
};
```

Keep `handleWeightCameraPress` / `handleWeightGalleryPress` exactly as they are (added last session, both tested working) — only the entry point changes from two visible buttons to one. Replace the two `TouchableOpacity` icon buttons in the JSX with a single quiet text button:

```tsx
<TouchableOpacity
  style={styles.weightCameraButton}
  onPress={handleFromPhotoPress}
  disabled={weightOcrBusy}
  accessibilityRole="button"
  accessibilityLabel="Log weight from a photo"
>
  {weightOcrBusy ? (
    <ActivityIndicator size="small" color={T.primary} />
  ) : (
    <Ionicons name="camera" size={20} color={T.primary} />
  )}
</TouchableOpacity>
```

Update the "Retake" call site (currently calls `handleWeightCameraPress` directly) to call `handleFromPhotoPress` instead, so retake also offers both sources.

- [ ] **Step 4: Wire the meal panel to the budget module**

Replace the free-form meal-type picker with the four sitting slices as the selector (spec: "no duplicate 'Which sitting' picker"). Track logged sittings in state:

```typescript
const [loggedMealTypes, setLoggedMealTypes] = useState<MealType[]>([]);
const kcalLeft = computeKcalLeft(loggedMealTypes);
```

Render the four slices using `sittingSliceState(type, selectedMealType, loggedMealTypes)` to decide fill (navy), outline ("now"/selected), or empty styling — replacing the old standalone meal-type picker UI. Tapping a slice sets `selectedMealType` (existing `handleMealTypeChange` already does this — reuse it, just change what triggers it from a picker control to tapping a slice). Show `kcalLeft` as the large hero number with a progress bar (`kcalLeft / MEAL_CAP`). Description + optional photo fields stay, styled quieter (smaller `FieldLabel`, less visual weight) per spec.

When a meal `Save`/submit actually persists a sitting's description (existing `mealDone` logic already checks `mealDescription.trim().length > 0 && submitSuccess`), add that sitting's type into `loggedMealTypes` — this is what makes the slice go from "selected" to "filled" and subtracts its kcal from the hero number. Cross-check against Task 4's Meals-tab `Save` — both places writing to the same `loggedMealTypes` concept need to agree; if `loggedMealTypes` should live in shared state (todayLog-derived) rather than local Home state so the Meals tab and Home tab don't disagree after navigating between them, derive it from `todayLog` fields instead of separate local state where possible — check how `todayLog` already represents per-sitting completion before introducing a second source of truth.

- [ ] **Step 5: Rename Submit button + add post-submit confirmation/Edit state**

Change the button label from `'Save Log'` to `'Submit today\'s log'`. After a successful submit (`submitSuccess === true`), swap the button to an "Edit" affordance (tapping re-enables the form fields) rather than leaving it saying "Submit today's log" indefinitely — check the existing `submitSuccessAnim` banner; extend it to also flip the primary button's label/behavior, not just show a temporary success flash.

- [ ] **Step 6: Apply the visual wash and frosted cards**

Wrap the screen root in `screenBackground` (Task 1) plus a `LinearGradient` using `screenWashColors` behind the content (peach → blue sky), and confirm all `Card`-based sections now render at the new 24px frosted radius from Task 1 with no further per-screen change needed (they consume `Card` already).

- [ ] **Step 7: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Manual on-device verification**

Run `npx expo start`, open Home: confirm status is one underlined word (no banner), tasks start collapsed, weight photo shows one button opening a two-option sheet, meal panel shows kcal-left hero + four sitting slices with no separate picker, submit button reads "Submit today's log" and flips to an editable/confirmed state after saving.

- [ ] **Step 9: Commit**

```bash
git add "apps/mobile/app/(client)/home.tsx"
git commit -m "feat(mobile): simplify Home to spec order (status word, collapsed tasks, meal-budget hero, single from-photo control)"
```

---

### Task 4: Meals tab — apply the same budget module and card retheme

**Files:**
- Modify: `apps/mobile/app/(client)/meals.tsx`

**Interfaces:**
- Consumes: `MEAL_CAP`, `MEAL_KCAL`, `MealType`, `computeKcalLeft` from `../../lib/mealBudget` (replace the locally-declared `MealType` union in this file with the imported one — check nothing else in this file's type shape conflicts)

- [ ] **Step 1: Add the limit card at the top**

Same kcal-left hero + progress bar as Home's Task 3 Step 4, computed from this screen's own loaded logged-sitting state (check how this screen currently determines which sittings already have a saved description — likely from the same `todayLog`/API fetch Home uses).

- [ ] **Step 2: Retheme the per-type cards**

Each existing per-meal-type `Card` (description, photo, Save) keeps its structure — only the visual layer changes via Task 1's `Card`/`fontFamily` updates, which this screen already imports and will pick up automatically. Confirm nothing in this file hardcodes `Inter`/`Manrope` font family strings directly (bypassing the `fontFamily` export) — grep first:

```bash
cd apps/mobile && grep -n "Inter_\|Manrope_" "app/(client)/meals.tsx"
```

Fix any direct literal usages found to use `fontFamily.*` instead.

- [ ] **Step 3: Typecheck + manual verification**

```bash
cd apps/mobile && npx tsc --noEmit
```

Then on-device: confirm the limit card matches Home's numbers when the same sittings are logged (no drift between the two screens' math — both call the same `computeKcalLeft`).

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/meals.tsx"
git commit -m "feat(mobile): wire Meals tab to shared meal-budget module, retheme cards"
```

---

### Task 5: Progress, Settings, Messages, Login, Activate, Change-password — visual retheme pass

**Files:**
- Modify: `apps/mobile/app/(client)/report.tsx`
- Modify: `apps/mobile/app/(client)/settings.tsx`
- Modify: `apps/mobile/app/messages.tsx`
- Modify: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/activate.tsx`
- Modify: `apps/mobile/app/change-password.tsx`

**Interfaces:**
- Consumes: everything from Task 1 (`screenBackground`, `screenWashColors`, `StatusWord`, retoned `Card`/`Avatar`, `fontFamily`)
- Produces: nothing further downstream

No structural changes on these six screens per the spec's checklist (Progress's weight trend / steps bars / heatmap / summary line / three alerts / "View full report" are already present and already match the checklist; Settings' profile/subscription/personal-info/change-password/logout are already present; Messages/Login/Activate/Change-password are already scoped correctly). This task is purely: apply the wash background, confirm `Card`/`Badge`/`Avatar`/font changes from Task 1 render correctly, and replace any client-facing status pill (e.g. subscription status Badge on Settings, alert-level Badge on Progress) with `StatusWord` where the spec's "one underlined word" rule applies to a health/account status — leave `Badge` in place for non-status chips (e.g. "Meal"/"Workout" tags) since the spec's pill ban is about brand-chrome status pills specifically.

For each of the six files:

- [ ] **Step 1: Wrap root container with `screenBackground` + wash gradient** (same pattern as Task 3 Step 6)
- [ ] **Step 2: Grep for direct `Inter_`/`Manrope_` literals and fix to `fontFamily.*`**

```bash
cd apps/mobile && grep -rn "Inter_\|Manrope_" "app/(client)/report.tsx" "app/(client)/settings.tsx" messages.tsx login.tsx activate.tsx change-password.tsx
```

- [ ] **Step 3: Replace client-status `Badge` calls with `StatusWord`** where the badge represents the client's own health/account status (subscription active/expired on Settings, absence-alert level on Progress) — leave other `Badge` usages (meal-type tags) as-is.
- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 5: Manual on-device pass through all six screens**, confirming wash background, frosted cards, Public Sans, no pill/gradient chrome remains.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(client)/report.tsx" "apps/mobile/app/(client)/settings.tsx" apps/mobile/app/messages.tsx apps/mobile/app/login.tsx apps/mobile/app/activate.tsx apps/mobile/app/change-password.tsx
git commit -m "feat(mobile): apply liquid-glass wash/status-word retheme to remaining client screens"
```

---

### Task 6: Floating capsule tab bar

**Files:**
- Modify: `apps/mobile/app/(client)/_layout.tsx`

**Interfaces:**
- Consumes: `T`, `fontFamily`, `cardShadow` from `../../lib/design-system`
- Produces: nothing further downstream (top-level nav shell)

- [ ] **Step 1: Restyle `tabBarContainer` from an edge-to-edge bar to a floating capsule**

Currently `tabBarContainer` is `backgroundColor: T.white`, full-width, flush to the screen edges with a top border. Change to a floating pill: fixed horizontal margin (e.g. `marginHorizontal: 16`), `position: 'absolute'`, `bottom: <safe-area-aware offset>`, `borderRadius: 32`, translucent white fill (`rgba(255,255,255,0.85)`) with `cardShadow`, no top border line. The existing sliding gradient indicator and per-tab spring-scale animation stay — they already work, only the container shape/positioning changes.
- [ ] **Step 2: Update screen content padding**

Since the tab bar becomes `position: 'absolute'` and floats above content instead of participating in layout flow, each of the four tab screens needs bottom padding/inset added to their scroll content so the last item isn't hidden behind the floating bar — check `home.tsx`, `meals.tsx`, `report.tsx`, `settings.tsx` for their outermost `ScrollView`/`contentContainerStyle` and add `paddingBottom` sized to the capsule's height + its bottom offset.
- [ ] **Step 3: Manual on-device verification**

Confirm the tab bar floats above content on all four tabs, doesn't clip on devices with a gesture-nav bottom inset (test on the Infinix HOT 40i preview build — this is exactly the kind of device-specific chrome issue that needs a real device, not just typecheck).
- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/_layout.tsx" "apps/mobile/app/(client)/home.tsx" "apps/mobile/app/(client)/meals.tsx" "apps/mobile/app/(client)/report.tsx" "apps/mobile/app/(client)/settings.tsx"
git commit -m "feat(mobile): floating capsule tab bar"
```

---

### Task 7: Full test suite, typecheck, and EAS preview rebuild

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full unit test suite**

```bash
cd apps/mobile && npx jest
```

Expected: all suites pass, including the new `mealBudget.test.ts` (Task 2) alongside the pre-existing `stepsSync.test.ts`, `stepsManualOverride.test.ts`, `weightOcr.test.ts`, `weightOcrState.test.ts`.

- [ ] **Step 2: Full typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Rebuild the preview APK**

```bash
cd apps/mobile && NODE_OPTIONS="--use-system-ca" npx eas-cli build --profile preview --platform android --non-interactive
```

(This machine needs `NODE_OPTIONS=--use-system-ca` for EAS's HTTPS calls — see prior build sessions.)

- [ ] **Step 4: Install fresh on the tester's Infinix HOT 40i (uninstall old build first — same package id) and run through all four tabs + login/activate/change-password/messages**, confirming the retheme and Home simplification hold up on real hardware, not just the emulator/Bluestacks.

- [ ] **Step 5: No commit** (verification-only; if Step 1 or 2 fail, fix and return to the relevant task above rather than committing a broken state).

---

## Self-Review Notes

- **Spec coverage:** Client palette/font/shape rules (Task 1), tab bar (Task 6), Home section order incl. meal budget (Tasks 2–3), Meals tab (Task 4), remaining five screens (Task 5), full verification (Task 7). Coach web is explicitly out of scope for this plan per the user's own sequencing ("client phone first, then web") — a separate plan is needed before touching `apps/web`.
- **Known gap acknowledged in the plan itself:** no `client.html`/`CLIENT-ROUTES.md`/`TOKENS.md` prototype was available on this machine. Every visual value in this plan is either copied verbatim from `COACHOS.md`'s prose or, where the prose doesn't specify an exact number (e.g. capsule tab-bar corner radius, wash gradient exact stops), a reasonable placeholder called out inline as such — these are the spots most likely to need a follow-up adjustment pass once the user can compare against the real prototype.
