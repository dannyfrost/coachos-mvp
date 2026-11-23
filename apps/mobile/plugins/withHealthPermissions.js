// Import via `expo/config-plugins` (not `@expo/config-plugins`): in this pnpm
// monorepo the scoped package is not directly resolvable from an app-level
// plugin file, but `expo` is a direct dependency and re-exports the same API.
const { withAndroidManifest } = require('expo/config-plugins');

/**
 * react-native-health-connect's own config plugin only registers the
 * permissions-rationale intent-filter; it does NOT declare which Health
 * Connect record types the app reads. Health Connect refuses to grant any
 * permission the manifest has not declared, so without these entries
 * requestPermission() silently resolves to "denied" and both the steps and
 * weight KPIs auto-sync fall through to their (broken) fallbacks forever.
 *
 * This plugin declares the read permissions the app actually requests in
 * lib/stepsHealthConnect.ts (Steps) and lib/weightHealthConnect.ts (Weight).
 * Keep this list in sync with the recordType permissions requested there.
 */
const HEALTH_READ_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_WEIGHT',
];

const withHealthPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const name of HEALTH_READ_PERMISSIONS) {
      const already = manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === name
      );
      if (!already) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // The camera stack (expo-camera) merges RECORD_AUDIO into the manifest for
    // video+mic capture, but this app only takes still photos — never records —
    // so the mic permission is unused and a Play-Store trust flag. Force it out
    // of the merged manifest with tools:node="remove" (and drop any direct copy).
    const RECORD_AUDIO = 'android.permission.RECORD_AUDIO';
    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (p) => !(p.$ && p.$['android:name'] === RECORD_AUDIO)
    );
    manifest['uses-permission'].push({
      $: { 'android:name': RECORD_AUDIO, 'tools:node': 'remove' },
    });
    // tools:node is only honored if the tools namespace is declared on <manifest>.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Android 14+ (API 34): Health Connect is built into the OS and REQUIRES an
    // activity that handles VIEW_PERMISSION_USAGE with category HEALTH_PERMISSIONS.
    // Without it every HC read/write throws
    //   IllegalStateException: Incorrect health permission state
    // (caught in readTodaySteps/readTodayWeight -> status 'error'), so the steps
    // and weight KPIs never sync on Android 14/15 devices even after the grant.
    // react-native-health-connect's own plugin only adds the Android-13
    // ACTION_SHOW_PERMISSIONS_RATIONALE intent, not this alias, so declare it here.
    const application = manifest.application && manifest.application[0];
    if (application) {
      application['activity-alias'] = application['activity-alias'] || [];
      const aliasName = 'ViewPermissionUsageActivity';
      const hasAlias = application['activity-alias'].some(
        (a) => a.$ && a.$['android:name'] === aliasName
      );
      if (!hasAlias) {
        application['activity-alias'].push({
          $: {
            'android:name': aliasName,
            'android:exported': 'true',
            'android:targetActivity': '.MainActivity',
            'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
              ],
              category: [
                { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
              ],
            },
          ],
        });
      }
    }

    return config;
  });
};

module.exports = withHealthPermissions;
