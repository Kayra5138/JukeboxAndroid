import { Switch as NativeSwitch, type SwitchProps } from 'react-native';

import { switchColours, useColours } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

/**
 * React Native's switch, in the theme's colours and feeling its flip: on one
 * way, off the other, as the app's choices do (`ui/haptics.ts`). React
 * Native's own makes no vibration of its own on Android. Everything else is
 * passed through. The colours were handed to it at every one of some forty
 * switches; they are its own now (`switchColours`).
 */
export function Switch({ onValueChange, ...rest }: SwitchProps) {
  const c = useColours();
  return (
    <NativeSwitch
      {...switchColours(c, rest.value === true)}
      {...rest}
      onValueChange={(on) => {
        haptic('choices', on ? 'toggleOn' : 'toggleOff');
        onValueChange?.(on);
      }}
    />
  );
}
