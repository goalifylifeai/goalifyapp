/**
 * iOS widget extension target, auto-discovered by @bacons/apple-targets.
 * The App Group must match lib/widget-bridge.ts (APP_GROUP) and be registered
 * for both the app and this target in the Apple Developer portal.
 *
 * @type {import('@bacons/apple-targets/app.config').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  name: 'GoalifyWidget',
  icon: '../../assets/icon.png',
  colors: {
    // Surfaced to the Swift asset catalog; mirrors constants/theme.ts.
    $paper: '#F4EFE6',
    $ink1: '#1F1B17',
    $ink3: '#7C7166',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.goalifylife.app'],
  },
});
