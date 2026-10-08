import { NativeModule, requireOptionalNativeModule } from 'expo';

/** What may be put in a file. A field left out is one the file keeps as it has it. */
export type FileDetails = {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  track?: number;
  disc?: number;
  /** The `file://` address of a picture the app has saved. */
  cover?: string;
};

/** What the native side says became of one file. See TagWriter.kt. */
export type NativeWrite = {
  status: 'written' | 'unchanged' | 'unsupported' | 'failed';
  reason: string | null;
  changed: string[];
  /** Where a finished copy was kept, when the file itself could not be completed. */
  kept: string | null;
};

declare class TagsModule extends NativeModule {
  /** False on Android 10, which has no way to ask for one file to be changed. */
  readonly supported: boolean;
  /** Raises the system's own question. False when the user said no. */
  requestWriteAsync(trackIds: string[]): Promise<boolean>;
  writeAsync(trackId: string, details: FileDetails): Promise<NativeWrite>;
}

// Optional, so a development build made before this module existed still opens
// the library instead of failing at import time. It simply has no such action.
export const tags = requireOptionalNativeModule<TagsModule>('JukeboxTags');
