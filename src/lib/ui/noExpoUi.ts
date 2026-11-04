/**
 * What `@expo/ui` is, as far as this app is concerned: nothing.
 *
 * `expo-router` brings it, and with it Jetpack Compose, some 7 MB of the
 * app, for the toolbars and floating bars of its own it can draw, none of
 * which the app uses: its bars are its own (`Frosted`, `TabBar`). Left out of
 * the build (`expo.autolinking.exclude` in package.json), the router still
 * loaded it, and the app stopped at its start for want of it; `metro.config.js`
 * hands the router this instead. Anything it asks of it is a component that
 * draws nothing, which it never draws.
 */
const nothing = () => null;

module.exports = new Proxy(
  {},
  {
    get: (_, key) => (key === '__esModule' ? true : key === 'then' || typeof key === 'symbol' ? undefined : nothing),
  }
);
