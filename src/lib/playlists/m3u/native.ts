import { NativeModule, requireOptionalNativeModule } from 'expo';

/** One playlist the user picked; see `ListFiles.read` in the module. */
export type PickedListFile = {
  uri: string;
  name: string | null;
  /** The document's id, where the picker's provider gives one: `primary:Music/Mix.m3u`, `raw:/storage/...`. */
  documentId: string | null;
  /** The whole path, where the media store would say it for a document of its own views. */
  path: string | null;
  /** The file's bytes, in base64; absent with a `problem`. */
  bytes?: string;
  problem?: 'tooBig' | 'unreadable';
};

declare class ListsModule extends NativeModule {
  /** Empty when the user backed out of the picker. */
  pickListFilesAsync(): Promise<PickedListFile[]>;
  /** The whole path of each track under the folder, by id, and the path of the phone's own storage. */
  trackPathsAsync(rootFolder: string): Promise<{ primary: string; paths: Record<string, string> }>;
  /** False when the user backed out of choosing where. */
  saveListFileAsync(name: string, text: string): Promise<boolean>;
  /** Null when the user backed out of choosing a folder. */
  saveListFilesAsync(
    names: string[],
    texts: string[]
  ): Promise<{ written: number; failed: string[]; folder: string } | null>;
}

// Optional, so that a build from before it still runs: the lists tab then
// has nothing to offer about files, which is how it always was.
export const listsNative = requireOptionalNativeModule<ListsModule>('JukeboxLists');
