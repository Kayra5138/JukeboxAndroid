import { Switch as NativeSwitch, type SwitchProps } from 'react-native';

import { haptic } from '../lib/ui/haptics';

/**
 * React Native's switch, which feels its flip: on one way, off the other,
 * as the app's choices do (`ui/haptics.ts`). React Native's own makes no
 * vibration of its own on Android. Everything else is passed through.
 */
export function Switch({ onValueChange, ...rest }: SwitchProps) {
  return (
    <NativeSwitch
      {...rest}
      onValueChange={(on) => {
        haptic('choices', on ? 'toggleOn' : 'toggleOff');
        onValueChange?.(on);
      }}
    />
  );
}
