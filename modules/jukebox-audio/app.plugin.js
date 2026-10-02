const { withGradleProperties, withAndroidManifest } = require('expo/config-plugins');

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
