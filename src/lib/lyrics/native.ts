import { NativeModule, requireOptionalNativeModule } from 'expo';

/** A folder just picked; see `LyricsFolders.adopt` in the module. */
export type PickedFolder =
  | { status: 'picked'; uri: string; label: string }
  /** Somewhere other than the phone's own storage, and not kept. */
  | { status: 'elsewhere' };

/** The files beside a song that could be its words; see `LyricsFolders.siblings`. */
export type Siblings = {
  status: 'found' | 'outside' | 'gone';
  /** The song's own file name. Absent when the track is `gone`. */
  name?: string;
  files?: { name: string; uri: string; size: number | null }[];
};

declare class LyricsModule extends NativeModule {
  /** Names and values from the track's own file, or null where it could not be read. */
  readEmbeddedAsync(trackId: string): Promise<string[] | null>;
  /** Null when the user backed out of the picker. */
  pickFolderAsync(): Promise<PickedFolder | null>;
  /** Which of these folders may still be read. */
  grantedFoldersAsync(folders: string[]): Promise<string[]>;
  releaseFolderAsync(folder: string): Promise<void>;
  siblingsAsync(trackId: string, folders: string[]): Promise<Siblings>;
  /** One file's bytes as base64, or null. */
  readDocumentAsync(document: string): Promise<string | null>;
}

// Optional, so that a build from before this existed still plays: it has no
// words but LRCLIB's, which is how it always was.
export const lyricsNative = requireOptionalNativeModule<LyricsModule>('JukeboxLyrics');
