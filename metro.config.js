// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `@expo/ui` is left out of the build, and the router is handed nothing in its place: see src/lib/ui/noExpoUi.ts.
const noExpoUi = path.resolve(__dirname, 'src/lib/ui/noExpoUi.ts');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === '@expo/ui' || name.startsWith('@expo/ui/')) return { type: 'sourceFile', filePath: noExpoUi };
  return (resolveRequest ?? context.resolveRequest)(context, name, platform);
};

module.exports = config;
