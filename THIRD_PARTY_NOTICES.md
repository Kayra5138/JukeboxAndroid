# Third-party components

Jukebox is released under the GNU General Public License, version 3 or later
(see `LICENSE`). This file lists what it is built on and how each part fits
with that licence.

The short version:

- Everything here is free software and compatible with GPL-3.0.
- Nothing proprietary is in the build.
- Native code is built from source at pinned commits, checked by SHA-256.

## YouTube engine

Already GPL-3.0, so there is nothing to reconcile.

| Project | Version | Licence |
| --- | --- | --- |
| youtubedl-android (deniscerri fork), library and FFmpeg artifacts | 0.19.0 | [GPL-3.0](https://github.com/deniscerri/youtubedl-android/blob/master/LICENSE) |
| yt-dlp, official executable | 2026.08.19 | [Unlicense, with bundled components](https://github.com/yt-dlp/yt-dlp#license) |
| FFmpeg, as bundled by the Android artifact | as packaged in 0.19.0 | [FFmpeg licence terms](https://ffmpeg.org/legal.html) |

Source and build instructions:

- https://github.com/deniscerri/youtubedl-android
- https://github.com/deniscerri/youtubedl-android/blob/master/BUILD_FFMPEG.md
- https://github.com/deniscerri/youtubedl-android/blob/master/BUILD_PYTHON.md
- https://github.com/yt-dlp/yt-dlp/tree/2026.08.19

Notes:

- The wrapper bundles its own Python and QuickJS runtime.
- The yt-dlp executable includes EJS and other third-party code, described in
  its upstream notices.
- yt-dlp is fetched by the build at that version and rejected if its SHA-256
  does not match.
- Anyone redistributing the app must keep these notices and meet the GPL's
  source-code obligations. Describing the combined app as MIT-only would be
  incomplete.
- No source from Seal, YTDLnis or NewPipe was copied into Jukebox.

## Playback and the Android build

| Project | Version | Licence |
| --- | --- | --- |
| [AndroidX Media3](https://github.com/androidx/media) (exoplayer, session, common) | 1.9.0 | [Apache-2.0](https://github.com/androidx/media/blob/release/LICENSE) |
| AndroidX and the Android Gradle toolchain | as resolved | Apache-2.0 |
| [React Native](https://github.com/facebook/react-native) | 0.86.2 | MIT |
| [Expo](https://github.com/expo/expo) | SDK 57 | MIT |
| [minimp3](https://github.com/lieff/minimp3), the MP3 decoder used by the game's chart maker | commit `ea99364f` | [CC0-1.0](https://github.com/lieff/minimp3/blob/master/LICENSE) |

Notes:

- Apache-2.0 code can go into a GPL-3.0 work but not into a GPL-2.0 one. That
  is why Jukebox is version 3.
- minimp3 is public domain and asks for no credit. It is listed because this
  file describes what the app is made of, not only what it is obliged to name.
- minimp3 does not arrive as a binary. The build fetches its two headers at
  that commit, rejects them if their SHA-256 does not match, and compiles the
  single C file in `modules/jukebox-audio/android/src/main/cpp` against them.

## Lyrics translation

| Project | Version | Licence |
| --- | --- | --- |
| [Foxlet Translate](https://github.com/yinvoke/foxlet-translate), the Android wrapper around Bergamot | 0.5.0, commit `0eff2a15` | MIT |
| [Bergamot](https://github.com/mozilla/translations), the engine (vendored into that repo from `inference/`) | commit `df4ab487` | MPL-2.0 |
| Marian, inside Bergamot | as vendored | MIT |
| SentencePiece, ruy and the abseil SentencePiece bundles, inside Bergamot | as vendored | Apache-2.0 |
| cpuinfo, simd\_utils, CLI11, half\_float, spdlog, yaml-cpp, cnpy, mio, pathie-cpp, faiss, phf, zstr, zlib, darts\_clone, esaxx, protobuf-lite | as vendored | BSD and MIT terms, each in its own directory |
| LLVM libc++ (`c++_shared`), linked from the NDK | NDK 27.1.12297006 | Apache-2.0 with LLVM exceptions |
| Unicode 17.0.0 sentence-break data, in the wrapper's sentence splitter | as vendored | [Unicode-3.0](https://www.unicode.org/license.txt) |
| [Mozilla's translation models](https://github.com/mozilla/firefox-translations-models) | fetched at runtime | MPL-2.0 |
| [`franc`](https://github.com/wooorm/franc), language identification | 6.2.0 | MIT |

Notes:

- Bergamot is the engine Firefox translates pages with. The models are the
  same ones Firefox downloads: 106 language pairs, 53 of them into English,
  around 30 MB each.
- Models are downloaded from Mozilla at runtime. No account, no key.
- **Nothing arrives as a binary.** `modules/jukebox-audio/android/build.gradle`
  fetches the source archive for one commit, rejects it if its SHA-256 is not
  the pinned one, and builds everything here: the engine with the NDK through
  CMake, the Kotlin wrapper alongside the rest of the module.
- That also covers MPL-2.0's requirement to say where the source of a binary
  is. The source is named by a hash that can be checked against what was built.
- The archive contains [FLORES-200](https://github.com/facebookresearch/flores)
  (CC-BY-SA 4.0), which the wrapper uses for its own benchmarks. It is test
  data for a benchmark app that is not built. It is not compiled into anything,
  it is not in the APK, and it is not in this repository. It only lands in the
  build directory (`modules/*/android/build/`, ignored by git) of whoever runs
  the build.
- The engine builds for 64-bit ARM only. On x86 and x86\_64, Marian's integer
  kernels (`intgemm`) are not part of the vendored tree. On 32-bit ARM,
  `simd_utils/sse2neon.h` needs `float64x2_t`, a NEON type that ARMv7 does not
  have. Jukebox therefore builds for `arm64-v8a` alone.

## Nothing proprietary

- Every component in this file is free software under terms that go into
  GPL-3.0.
- The source for all of it is either in this repository or fetched by the
  build from a commit named by its hash.
- Google's ML Kit used to do the translating and was the one exception. It has
  been removed: `com.google.mlkit` appears in no Gradle file here. Bergamot
  translates and `franc` identifies the language.
- Translation sits behind one module boundary, `JukeboxTranslate`. Nothing
  else in the app depends on it.

## Data and the services it comes from

| Source | Used for | Terms |
| --- | --- | --- |
| [MusicBrainz](https://musicbrainz.org) genre vocabulary | 2,188 genre names, bundled in `src/lib/metadata/data/`, regenerated by `scripts/update-genres.mjs` | [CC0](https://musicbrainz.org/doc/About/Data_License) |
| [MusicBrainz](https://musicbrainz.org) web service | Looking a track up, and finding an artist to photograph | CC0 for the data used here |
| [ListenBrainz](https://listenbrainz.org) | Which artists are played alongside which | [CC0](https://listenbrainz.org/data/) |
| [Cover Art Archive](https://coverartarchive.org) | Covers next to a recommendation | Per image, served by the Internet Archive |
| [LRCLIB](https://lrclib.net) | Lyrics, timed where available | Public domain |
| [Apple iTunes Search](https://performance-partners.apple.com/search-api) | Tags and covers MusicBrainz did not have | Apple's API terms |
| [Wikimedia Commons](https://commons.wikimedia.org) | One photograph per artist on a recap card | Per file, mostly CC-BY or CC-BY-SA |

Notes:

- The genre vocabulary is the only one of these that ships inside the APK, and
  it is CC0.
- Everything else is requested over the network and cached on the device.
- None of these services needs an account or an API key.
- A recap card that shows a Commons photograph prints the photographer and the
  licence in its corner. Those licences require attribution, and the credit is
  what makes saving and sharing the card allowed.
- A card made of album covers carries no credit line, because it makes no such
  claim.

## JavaScript dependencies

About 600 packages in the lockfile, development tooling included. The licences
at the time of writing:

| Licence | Packages |
| --- | --- |
| MIT | 521 |
| ISC | 29 |
| Apache-2.0 | 13 |
| MPL-2.0 | 12 |
| BSD-3-Clause, BSD-2-Clause | 11 |
| BlueOak-1.0.0 | 6 |
| Unlicense, 0BSD | 4 |
| Dual or combined (MIT/CC0-1.0, MIT/Apache-2.0, BSD-3-Clause/GPL-2.0) | 5 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |

The ones worth a word:

- **MPL-2.0** is `lightningcss` and its per-platform binaries. File-level
  copyleft, and build tooling rather than code that ships in the app.
- **`node-forge`** is dual-licensed BSD-3-Clause or GPL-2.0. It is taken here
  under BSD-3-Clause.
- **BlueOak-1.0.0** (`glob`, `minimatch`, `minipass`, `path-scurry`,
  `lru-cache`, `sax`) is a permissive licence.
- **Python-2.0** is `argparse`.
- **CC-BY-4.0** is `caniuse-lite`, a browser-support dataset used by build
  tooling.

All of these are compatible with GPL-3.0. Run `npm ls --all` for the resolved
tree. Each package carries its own licence text in `node_modules`.
