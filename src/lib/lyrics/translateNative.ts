import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class TranslateModule extends NativeModule {
  /** False for a language there is no on-device model for. */
  isSupportedAsync(language: string): Promise<boolean>;
  isModelReadyAsync(language: string): Promise<boolean>;
  /**
   * False for a language lyrics cannot be put into. English always can be.
   * Optional, like the two below it: a build from before lyrics could go
   * anywhere but English has none of the three.
   */
  isTargetSupportedAsync?(target: string): Promise<boolean>;
  /** True when lyrics in `source` can be put into `target`, by one model or by two through English. */
  isPairSupportedAsync?(source: string, target: string): Promise<boolean>;
  /** True when every model that takes is already on the device, so nothing would be downloaded. */
  isPairReadyAsync?(source: string, target: string): Promise<boolean>;
  /**
   * Translates line by line, answering with one line for every line given.
   * Downloads the model first if it is not already on the device.
   */
  translateLinesAsync(lines: string[], source: string, target: string): Promise<string[]>;
}

// Optional, so a development build made before this module existed still opens
// the library instead of failing at import time.
export const translator = requireOptionalNativeModule<TranslateModule>('JukeboxTranslate');
