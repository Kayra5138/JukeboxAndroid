import { Modal as NativeModal, type ModalProps } from 'react-native';

import { useMotionReduced } from '../lib/ui/motion';

/**
 * A window of its own over the app, for a sheet: React Native's, which
 * fades in and out as it is told, and comes and goes at once while the
 * decoration is held still. Every sheet in the app is opened in one of these.
 */
export function Modal({ animationType, ...props }: ModalProps) {
  const still = useMotionReduced();
  return <NativeModal {...props} animationType={still ? 'none' : animationType} />;
}
