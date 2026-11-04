# Third-party components

Jukebox is released under the GNU General Public License, version 3 or later
(see `LICENSE`). This file lists what it is built on and how each part fits
with that licence.

The short version:

- Everything here is free software and compatible with GPL-3.0.
- Nothing proprietary is in the build.
- The translation engine, the MP3 decoder, the tag writer and the YouTube
  engine's FFmpeg are built from source at pinned releases, checked by SHA-256.
- The YouTube engine's Python and QuickJS are the exception: they arrive
  prebuilt inside the wrapper's Maven artifact, which is checked by SHA-256 but
  was compiled upstream.

## YouTube engine

Already GPL-3.0, so there is nothing to reconcile.

| Project | Version | Licence |
| --- | --- | --- |
| youtubedl-android (deniscerri fork), library artifact | 0.19.0 | [GPL-3.0](https://github.com/deniscerri/youtubedl-android/blob/master/LICENSE) |
| yt-dlp, official executable | 2026.10.26 | [Unlicense, with bundled components](https://github.com/yt-dlp/yt-dlp#license) |
| [FFmpeg](https://ffmpeg.org/), built here with only what the downloads use | 9.0.2, commit `946fcce0` | [LGPL-2.1-or-later as configured](https://ffmpeg.org/legal.html) |
| [LAME](https://lame.sourceforge.io/), the MP3 encoder FFmpeg is built with | 3.100 | [LGPL-2.0-or-later](https://sourceforge.net/p/lame/svn/HEAD/tree/trunk/lame/COPYING) |
| CPython and its standard library, prebuilt in the `library` artifact | as packaged in 0.19.0 | [PSF-2.0](https://docs.python.org/3/license.html) |
| [QuickJS](https://bellard.org/quickjs/), prebuilt in the `library` artifact | as packaged in 0.19.0 | MIT |
| Jackson (databind, annotations, core) and Apache Commons IO, which the wrapper depends on | as resolved | Apache-2.0 |

Source and build instructions:

- https://github.com/deniscerri/youtubedl-android
- https://github.com/FFmpeg/FFmpeg/tree/946fcce07b6dcd0331c8cc609192aeff5e1924f8
- https://sourceforge.net/projects/lame/files/lame/3.100/
- https://github.com/deniscerri/youtubedl-android/blob/master/BUILD_PYTHON.md
- https://github.com/yt-dlp/yt-dlp/tree/2026.10.26

Notes:

- **Python and QuickJS arrive as binaries.** The wrapper's artifact carries
  Python and its libraries per architecture, plus QuickJS, all compiled
  upstream. The build here takes it from Maven Central at version 0.19.0 and
  refuses it unless its SHA-256 matches. Its source is the upstream repository
  and build instructions linked above, and the Termux packages those
  instructions build from.
- Some of what that Python archive holds is left out of the app, unchanged
  otherwise: QuickJS's static library, PyCryptodome, mutagen, SQLite, ncurses
  and readline, and Python's test modules, lib2to3 and venv
  (`modules/jukebox-audio/android/build.gradle`, `youtubedlLeftOut`). Their
  notices are not needed for what is shipped.
- FFmpeg and LAME do not arrive as binaries. The build fetches FFmpeg as
  GitHub's archive of the commit tagged n9.0.2, and LAME as SourceForge's 3.100
  release, refuses either unless its SHA-256 matches, and compiles both with
  the NDK (`modules/jukebox-audio/android/ffmpeg/build.sh`). FFmpeg is
  configured without `--enable-gpl` or anything non-free, and with only the
  formats, codecs and filters the downloads need: no network, no video. Saving
  as MP3 goes through LAME. The wrapper's own FFmpeg artifact is not used.
- The wrapper also carries an older yt-dlp of its own. It is emptied out of
  the app: the official executable named above is the one put in its place.
- The yt-dlp executable includes EJS and other third-party code, described in
  its upstream notices.
- yt-dlp is fetched by the build at that version and rejected if its SHA-256
  does not match.
- The app can replace that copy with a newer official release of yt-dlp when
  its user asks it to. That one is fetched by the phone from the same GitHub
  releases and checked against the checksums the release publishes, not
  against a hash chosen here.
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
| [kotlinx.coroutines](https://github.com/Kotlin/kotlinx.coroutines) | 1.8.1 | Apache-2.0 |
| [minimp3](https://github.com/lieff/minimp3), the MP3 decoder used by the game's chart maker | commit `ea99364f` | [CC0-1.0](https://github.com/lieff/minimp3/blob/master/LICENSE) |

Notes:

- Apache-2.0 code can go into a GPL-3.0 work but not into a GPL-2.0 one. That
  is why Jukebox is version 3.
- minimp3 is public domain and asks for no credit. It is listed because this
  file describes what the app is made of, not only what it is obliged to name.
- minimp3 does not arrive as a binary. The build fetches its two headers at
  that commit, rejects them if their SHA-256 does not match, and compiles the
  single C file in `modules/jukebox-audio/android/src/main/cpp` against them.

## Writing tags into files

| Project | Version | Licence |
| --- | --- | --- |
| [TagLib](https://github.com/taglib/taglib), which reads and writes the ID3v2 tags of an MP3 and the comments and pictures of a FLAC | 2.3.2, commit `deadc299` | [LGPL-2.1](https://github.com/taglib/taglib/blob/master/COPYING.LGPL) or [MPL-1.1](https://github.com/taglib/taglib/blob/master/COPYING.MPL), taken here under the LGPL |
| [utfcpp](https://github.com/nemtrif/utfcpp), which TagLib converts text with | 4.2.0, commit `2d8e20b2` | [BSL-1.0](https://github.com/nemtrif/utfcpp/blob/master/LICENSE) |

Notes:

- Used for one thing: **Write to file**, which puts a track's details into the
  file itself when asked to. Nothing else in the app alters a music file.
- Neither arrives as a binary. The build fetches the source archive of each at
  that commit, rejects it if its SHA-256 is not the pinned one, and compiles
  TagLib with the NDK as a static library holding only its MP3 and FLAC parts.
  That is linked into `libjukeboxtags.so` together with the app's own code in
  `modules/jukebox-audio/android/src/main/cpp/tags`.
- utfcpp is headers only. TagLib keeps it as a git submodule, which a source
  archive does not include, so it is fetched separately at the commit TagLib's
  tree pins.
- TagLib is dual-licensed. MPL-1.1 on its own does not go into a GPL work, so
  it is taken under LGPL-2.1, whose section 3 allows a copy to be used under
  the GPL, version 2 or any later.
- The LGPL asks that whoever receives the binary can rebuild it against a
  changed TagLib. The whole app is source and the build file is the recipe:
  change the commit and the hash and build.
- zlib is used through Android's own `libz.so`, for ID3v2 frames stored
  compressed. It is part of the system and not in the APK.
- The C++ runtime is the shared `c++_shared` listed under Lyrics translation.

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
  build from a commit named by its hash, except the prebuilt parts of the
  YouTube engine, whose source is upstream as described in that section.
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
| [ListenBrainz](https://listenbrainz.org) | Which artists are played alongside which. Listens are submitted to it only when the user connects their account and switches sending on | [CC0](https://listenbrainz.org/data/) |
| [Cover Art Archive](https://coverartarchive.org) | Covers next to a recommendation | Per image, served by the Internet Archive |
| [LRCLIB](https://lrclib.net) | Lyrics, timed where available | Public domain |
| [Apple iTunes Search](https://performance-partners.apple.com/search-api) | Tags and covers MusicBrainz did not have | Apple's API terms |
| [Wikimedia Commons](https://commons.wikimedia.org) | One photograph per artist on a recap card | Per file, mostly CC-BY or CC-BY-SA |
| [SponsorBlock](https://sponsor.ajay.app) | The parts of a YouTube tape its users marked as a sponsor's message, self-promotion or a request to subscribe, passed over while it plays | [CC BY-NC-SA 4.0](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License) |
| [Apple iTunes Search](https://performance-partners.apple.com/search-api), podcasts | Finding a podcast and its feed | Apple's API terms |
| Podcast feeds | A show's episodes, and their chapters and transcripts where the feed gives them | Each podcast's own |
| [Internet Archive](https://archive.org) and [LibriVox](https://librivox.org) | Finding and fetching books read aloud | LibriVox recordings are in the public domain; other items per item |

Notes:

- The genre vocabulary is the only one of these that ships inside the APK, and
  it is CC0.
- Everything else is requested over the network and cached on the device.
- None of these services needs an account or an API key to read from.
  Submitting listens to ListenBrainz is optional and uses the user's own
  token, which is kept on the device and out of backups.
- A recap card that shows a Commons photograph prints the photographer and the
  licence in its corner. Those licences require attribution, and the credit is
  what makes saving and sharing the card allowed.
- A card made of album covers carries no credit line, because it makes no such
  claim.
- SponsorBlock's data is by its users, licensed CC BY-NC-SA 4.0. Jukebox only
  reads it, to pass those parts over while a tape plays, and keeps a copy of a
  tape's parts on the phone; it is not shown, shared or sold. The credit is
  here and in the README.

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
