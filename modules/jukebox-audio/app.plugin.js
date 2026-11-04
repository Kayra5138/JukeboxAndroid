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
/**
 * Release builds are shrunk: R8 drops the code nothing calls and shortens
 * the names of the rest, which took the app's own code from 49 MB to 17 and
 * the APK from 121 MB to 89. What has to be kept from it is in the module's
 * `consumer-rules.pro`, each rule with its reason.
 */
const MINIFY = 'android.enableMinifyInReleaseBuilds';

/**
 * Memory for the build, which the template's two gigabytes no longer cover:
 * putting the APK together, at some 97 MB with the downloader, the
 * translation engine and the tag library in it, ran out of heap and failed
 * at `packageRelease`.
 */
const JVM_ARGS = 'org.gradle.jvmargs';
const JVM_ARGS_VALUE = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

/**
 * Jukebox offered for any sound file: opened from Files, from a chat's
 * attachment, from a download, and shared to it from another app, one file or
 * several. What arrives is played (see `OpenedAudio.kt` and
 * `player/OpenedAudio.tsx`). Added to the main activity once, should the
 * plugin run again over a manifest that has them.
 */
const OPEN_WITH_MIME = ['audio/*', 'application/ogg', 'application/x-flac'];

function withOpenWith(manifest) {
  const application = manifest.manifest.application[0];
  const activity = (application.activity ?? []).find((one) => one.$['android:name'] === '.MainActivity');
  if (!activity) return;
  const filters = activity['intent-filter'] ?? [];
  // Ours are the ones that take sound files: told apart by that, with nothing added to them that a person would see.
  const ours = (filter) => (filter.data ?? []).some((one) => one.$?.['android:mimeType'] === 'audio/*');
  const kept = filters.filter((filter) => !ours(filter));
  const data = (schemes) =>
    OPEN_WITH_MIME.flatMap((mime) =>
      schemes.length ? schemes.map((scheme) => ({ $: { 'android:scheme': scheme, 'android:mimeType': mime } })) : [{ $: { 'android:mimeType': mime } }]
    );
  kept.push(
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: data(['content', 'file']),
    },
    {
      action: [
        { $: { 'android:name': 'android.intent.action.SEND' } },
        { $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } },
      ],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: data([]),
    }
  );
  activity['intent-filter'] = kept;
}

module.exports = function withJukeboxMinSdk(config) {
  config = withWindowBehindTheSplash(config);
  config = withAndroidManifest(config, (mod) => {
    mod.modResults.manifest.application[0].$['android:extractNativeLibs'] = 'true';
    withOpenWith(mod.modResults);
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults
      .filter(
        (item) =>
          !(
            item.type === 'property' &&
            [KEY, 'expo.useLegacyPackaging', 'reactNativeArchitectures', MINIFY, JVM_ARGS].includes(item.key)
          )
      )
      .concat(
        { type: 'property', key: KEY, value: MIN_SDK },
        { type: 'property', key: 'expo.useLegacyPackaging', value: 'true' },
        { type: 'property', key: 'reactNativeArchitectures', value: ARCHITECTURES },
        { type: 'property', key: MINIFY, value: 'true' },
        { type: 'property', key: JVM_ARGS, value: JVM_ARGS_VALUE }
      );
    return mod;
  });
};
