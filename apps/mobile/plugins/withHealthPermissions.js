const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

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

    return config;
  });
};

module.exports = withHealthPermissions;
