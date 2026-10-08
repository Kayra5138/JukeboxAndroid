const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
  withGradleProperties,
} = require('expo/config-plugins');

const KEY = 'android.minSdkVersion';
const MIN_SDK = '29';

/**
 * The only architecture this project builds for.
 *
 * Expo's default is all four, which quadruples the native libraries in the APK
 * to carry three that nothing here can use: the translation engine compiles for
 * AArch64 alone — 32-bit ARM has no `float64x2_t` and the x86 integer kernels
 * are not in the tree — so a build for the other three ships an app whose
 * translate button turns on and reveals nothing. Set here rather than passed on
 * the command line so that forgetting the flag cannot quietly produce one.
 */
const ARCHITECTURES = 'arm64-v8a';

/**
 * Makes the window the colour of the splash that was just on it.
 *
 * Between the splash going and the first screen being drawn there is the
 * bare window, and left alone it is the system's own idea of a background:
 * near enough white by day, and by night a mid grey that is nothing like the
 * page. The splash's colour is already kept twice, once for each — the splash
 * plugin writes `splashscreen_background` to `values` and to `values-night`
 * from app.json — so the window is pointed at that one name and follows the
 * phone exactly as the splash did.
 *
 * Expo has a setting for this, `backgroundColor`, and it holds one colour,
 * which would be the wrong one in one of the two modes.
 *
 * Both follow the phone, not the theme chosen in Settings: that is kept in
 * the app's own store, which nothing can read until JavaScript is running,
 * and by then the splash is over. Someone on a light phone who chose a dark
 * theme sees a light splash and then a dark app. Once running, the root
 * layout repaints the window in the theme's page colour.
 */
function withWindowBehindTheSplash(config) {
  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:windowBackground',
      value: '@color/splashscreen_background',
    });
    return mod;
  });
}

/**
 * Raises the generated Android project to API 29.
 *
 * The module declares `minSdk 29` in its own build.gradle because it uses
 * scoped storage — RELATIVE_PATH, IS_PENDING, volume-scoped MediaStore uris —
 * with no fallback. Expo's default is 24, and the manifest merger refuses to
 * put a library with a higher floor into an app with a lower one, so prebuild
 * would produce a project this module cannot be linked into.
 *
 * The property is the one the Expo settings plugin reads to override its
 * version catalog, which is why it is set here rather than in a gradle file
 * that prebuild would overwrite.
 */
module.exports = function withJukeboxMinSdk(config) {
  config = withWindowBehindTheSplash(config);
  config = withAndroidManifest(config, (mod) => {
    mod.modResults.manifest.application[0].$['android:extractNativeLibs'] = 'true';
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults
      .filter(
        (item) =>
          !(
            item.type === 'property' &&
            [KEY, 'expo.useLegacyPackaging', 'reactNativeArchitectures'].includes(item.key)
          )
      )
      .concat(
        { type: 'property', key: KEY, value: MIN_SDK },
        { type: 'property', key: 'expo.useLegacyPackaging', value: 'true' },
        { type: 'property', key: 'reactNativeArchitectures', value: ARCHITECTURES }
      );
    return mod;
  });
};
