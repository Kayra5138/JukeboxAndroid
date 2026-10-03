# Jukebox

A music player for Android that plays the files already on your phone.

No account, no server, no ads, no tracking. Your library, your listening history
and your stats never leave the device. It is free software (GPL-3.0-or-later),
and it comes with a rhythm game built out of your own songs, because why not.

## Features

### Library and playback

- Pick a folder in Settings and Jukebox plays everything under it, subfolders
  included.
- Browse by track or by album. Sort by name, date added or most played, and
  search as you type.
- Swipe a track right to play it next, left to add it to the end of the queue.
- Long-press a track for the full menu: play next, add to queue, go to album,
  add to a list, look up details, edit tags, lyrics, file details, delete.
- Select several tracks at once to add them to a list or delete them.
- A queue you can reorder, trim and jump around in.
- Repeat off, one or all.
- Jump back and forward by 5, 10, 15, 30 or 60 seconds (your pick).
- Speed and pitch sliders that work independently: slow a song down without
  dropping its pitch, or shift the pitch in semitones at normal speed.
- Deleting a track goes through Android's own confirmation, so the app never
  needs write access to your storage.

### A shuffle that feels random

- A fair shuffle puts three songs by the same artist in a row more often than
  you would expect, and it feels broken when it does.
- Jukebox shuffles each artist's tracks, then deals them out evenly across the
  queue. Two songs by one artist landing together stops being a matter of luck.
- 3,000 tracks shuffle in under a millisecond.

### Sound

- Equalizer: the device's own bands and presets, plus bass boost, surround and
  loudness.
- Real crossfade. A second player carries the tail of the outgoing track.
  Separate lengths for a track ending, a skip, a pause and a seek.
- Stereo effects: width, balance, channel swap, headphone crossfeed, slow
  rotation ("8D") and a preamp.
- One-tap presets: Mono, Wide, Headphones, 8D, Karaoke-ish.
- Voice effects: Robot, Vintage, Swirl, Chipmunk, More chipmunk.
- Presets and voices are one tap away in the player's own settings sheet. The
  fine-tuning sliders live on their own screen.

### Lyrics

- Fetched from LRCLIB, synced line by line when a timed version exists.
- On-device translation with Bergamot, the engine behind Firefox Translations.
  Models come from Mozilla. No account, no key.
- Fix things by hand: nudge the timing in quarter-second steps, search the
  catalogue yourself, or paste your own lyrics.

### Tags and metadata

- One lookup against MusicBrainz and iTunes fills in artist, album, year, cover
  and track number for files that came without them.
- Tracks get an ordered list of tags instead of a single genre.
- Tags are filtered against MusicBrainz's genre vocabulary (2,188 entries,
  bundled), so `seen live` never shows up in your stats.
- Songs with more than one artist are found too. `Eminem, Rihanna`,
  `Eminem feat. Rihanna` and a guest left in the title are searched name by
  name, and `(Official Video)` is not part of the title.
- Everything is editable, and a later lookup never overwrites what you typed.
- `Rock` and `rock` are the same tag.

### Lists and albums

- Lists ordered by hand, with a cover of your choice: a grid of four, one
  track's cover, or a picture from your phone.
- Make a list from a tag in two ways. A *following* list always mirrors the
  tag. A *copy* is yours to rearrange.
- Suggestions for what else belongs in a list, based on its tags. Rare tags
  weigh more than common ones.
- Four automatic lists built from your history: Most played, New this month,
  Forgotten and Skipped most.
- Albums are assembled from your tags. In landscape you can flick through them
  as a rack of sleeves instead of a list.

### Stats and recap

- Every listen past 30 seconds is recorded. So is every skip.
- Stats by day, week, month, year or all time, compared with the period before.
- A chart you can scrub, with the top tracks, artists and genres behind it.
- A song by two artists counts for both. `Eminem, Rihanna` is never an artist
  of its own, and `Earth, Wind & Fire` is never three.
- Recap cards you can save or share. Artist photos come from Wikimedia Commons
  and the credit is printed on the card.

### Discover

- Suggests artists you do not have yet, based on the ones you actually play.
- Powered by ListenBrainz: real listening habits, not a catalogue's idea of
  genre.
- Each suggestion comes with a song to start from and its cover.

### Downloads

- The Search tab finds songs on YouTube by name, by link or by playlist.
- Save as MP3 or keep the original audio.
- A playlist becomes a local list with the same name, in the same order and
  without duplicates.
- Downloads keep going when you leave the app, and unfinished ones are picked
  up again when you come back.

### Piano Tiles

Long-press any track and choose **Play piano tiles**. The game is generated
from the song itself.

- **Charts from audio.** The song is analysed on the device, with no account
  and no server.
- **Keys land on the beat.** The song's pulse is followed from start to finish,
  so the board stays in time even when the band speeds up or drags.
- **Keys follow the tune.** The melody is tracked and its pitch decides the
  column: low notes on the left, high notes on the right. Where nobody is
  singing or playing a tune, the drums and bass decide instead.
- **A chorus is the same keys every time.** Bars that are the same music are
  found by ear (harmony, sound and rhythm) and given one pattern, rests and
  holds included. What you learned the first time still works the third.
- **A ladder of keys.** Every key has the same height and each one starts where
  the last ended. Long notes become hold keys.
- **Holds are worth their length.** One point per row, and a hold counts as
  kept at 60% so your hand is free before the next key.
- **It breathes with the music.** Rows stay empty where the song is silent
  (30 dB under its usual level for 1.5 s) and where it eases off.
- **Four difficulties: Easy, Normal, Hard, Harder.** Each one runs at the same
  pace on every song, within about a fifth, whatever the tempo. A bar is always
  cut into a whole number of keys.
- **Two-finger notes** on Hard and Harder, on the moments the music hits
  hardest, never in neighbouring columns.
- **Five lives.** Fifty clean keys in a row give one back.
- **Sounds that cannot clash with the song.** Every effect is shaped noise with
  no pitch: tap, empty tap, missed key, a soft breath while holding, a rising
  sweep for a completed hold.
- **Colours from the album cover**, one shade per column.
- **Latency offset** for Bluetooth headphones.
- **Fast to start.** MP3s are decoded inside the app with minimp3, so a chart
  takes about two seconds instead of six to ten. Charts are cached after that.
- The song starts and stops with the run, and Back pauses instead of quitting.
- **An ending you can read.** The board stops and stays, and the score fades in
  over it. Lose, and the move that did it is marked in red: the key that got
  past is brought back to the foot of its column, an empty tap gets a mark
  under your finger. Reach the end of the song and confetti flies.

### Around the phone

- Home-screen widget and media notification, both with working controls.
- Playback keeps going with the app closed.
- Android Auto: browse by track, album or list from the car.
- A landscape layout: tabs move to a rail on the left, the player to a panel on
  the right.
- A "hold the decoration still" switch for older phones. It turns off the
  decorative animations and leaves the game playable.

### Your data

- **Export everything** in Settings writes one zip: listening history, skips,
  lists, tags, track details, lyrics and translations, covers, settings and the
  sound setup.
- Not in it: the music itself, the download history and the library folder.
- **Import** reads that zip on any phone. Songs are found again by file name,
  then by title, artist and length, because a song's id differs between phones.
- Before anything is written you see what is in the backup and how many of its
  songs are on this phone.
- If the phone already holds data you choose: **Merge** adds the backup to what
  is here and removes nothing, **Replace** swaps it in.
- Merging the same backup twice adds nothing. A listen is counted once.
- The write is all or nothing. A failed import leaves the phone as it was.

## What touches the network

Playback, the library, stats, lists and the game work fully offline. These are
the only things that go out, and none of them needs an account or an API key.

| When you | It talks to |
| --- | --- |
| Look up a track's details | MusicBrainz, iTunes Search |
| Fetch lyrics | LRCLIB |
| Translate lyrics | Mozilla (model download, once per language) |
| Open a recap | MusicBrainz, Wikimedia Commons (artist photos) |
| Ask for recommendations | ListenBrainz, Cover Art Archive |
| Use the Search tab | YouTube |

## Requirements

- Android 10 (API 29) or newer, 64-bit ARM
- Node 22.6+ (the tests run TypeScript directly through Node's type stripping)
- JDK 17
- Android SDK, plus the NDK and CMake 3.22.1 from the SDK manager

## Building

```bash
npm install
npm test                 # 593 tests, pure logic
npx tsc --noEmit         # typecheck

npx expo prebuild --platform android

cd android
./gradlew :jukebox-audio:testDebugUnitTest   # 124 more, in Kotlin
./gradlew :app:assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Good to know:

- `android/` is generated and not in the repository. Run `prebuild` once in a
  fresh checkout, and again whenever `app.json` or a config plugin changes.
- The first build compiles the translation engine from source: about 20 MB of
  C++ to fetch and roughly a minute to build. After that it is cached.
- Builds are `arm64-v8a` only. The translation engine does not compile for
  32-bit ARM or x86, so the config plugin pins the architecture for you.
- Your own builds are signed with the debug keystore, which is fine for your
  own phone. The APKs on the Releases page are signed with a private key (see
  `scripts/release-apk.sh`), so Android will not install one over the other.
  Uninstall first if you switch.
- If an installed build runs stale JavaScript, clear the bundle cache:
  `rm -rf android/app/build/generated/assets/react`
- Icons are generated from `assets/source` by `scripts/icons.sh` (needs
  ImageMagick).

## Permissions

| Permission | Why |
| --- | --- |
| `READ_MEDIA_AUDIO` | Reading your music |
| `POST_NOTIFICATIONS` | The playback notification |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Playing in the background |
| `FOREGROUND_SERVICE_DATA_SYNC` | Downloads that outlive the screen |
| `MODIFY_AUDIO_SETTINGS` | Attaching the equalizer |
| `WAKE_LOCK` | Keeping the phone awake while music plays |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Lookups, lyrics, downloads, and telling "offline" from "failed" |
| `VIBRATE` | Haptics on swipes and in the game |

Two things are switched off on purpose: `SYSTEM_ALERT_WINDOW` is blocked (a
music player has no reason to draw over other apps), and `allowBackup` is
false, so your listening history cannot be pulled over `adb`. Getting it out is
your call: Settings, Export everything.

## Project layout

```
src/
  app/          screens, file-routed with expo-router
  components/   shared views
  screens/      the larger screens the routes point at
  lib/          everything that is not a view
  lib/tiles/    the game's rules: pure functions, fully tested
modules/jukebox-audio/
  android/      Kotlin: playback, library, downloads, effects, chart analysis
  android/src/main/cpp/   the in-app MP3 decoder (one C file)
  src/          the module's TypeScript surface
assets/source/  the icon as drawn; every other size is generated
scripts/        icons, genre vocabulary refresh, release signing, Android Auto helper
```

## How it works

- **Stack:** Expo SDK 57, React Native 0.86 (new architecture, Hermes), React
  19, expo-router, Reanimated 4, expo-sqlite.
- **Playback** is a Media3 `MediaLibraryService` holding an `ExoPlayer` and the
  whole queue. The notification, the widget, the car and the app all talk to it
  through a `MediaController`. No JavaScript has to be running for music to
  play, which is why a media button still works after the app is gone.
- **The media session is closed to strangers.** Only the app itself, the system
  and known browsers (Android Auto, Wear, Assistant, system UI, Bluetooth) may
  connect.
- **The game board** runs on the UI thread with Reanimated worklets. Tiles are
  moved with transforms only, so a frame never reaches layout.
- **The game clock never jumps.** When it disagrees with the audio it changes
  its rate by a bounded amount until they agree again. A position that jumps is
  a board that stutters.
- **Chart analysis** is Kotlin, in two passes. A short window finds the onsets
  and, from their autocorrelation, the song's smallest steady step; dynamic
  programming then lays a line on every step. A long window gives harmony,
  timbre and the melody (harmonic summation and a Viterbi path).
- **The board runs in grid time.** The chart says where each step really falls
  in the recording, and the board reads the player's position through that, so
  rows stay equal while the clock bends with the band.
- **Tests cover logic, not UI:** calendar arithmetic for stats, tag weighting,
  the shuffle spread, lyric parsing, crossfade rules, backup merging, the game's
  rules. The Kotlin tests render audio buffers and measure what came out.
- **A backup is a zip** with one JSON document and the cover files. Merging is
  a pure function over two sets of tables, tested against a real SQLite, and
  the result goes in under a single transaction.
- **Third-party native code is built from source.** Bergamot and minimp3 are
  fetched at pinned commits and rejected if their SHA-256 does not match.

## Licence

Copyright (C) 2026 Kayra5138. **GPL-3.0-or-later**, see [LICENSE](LICENSE).

- Copyleft on purpose: if you get the app you get the source, and whatever is
  built on it stays open.
- There is nothing proprietary in the build. Translation is Bergamot (MPL-2.0),
  language detection is `franc` (MIT), the MP3 decoder is minimp3 (CC0).
- Version 3 because Media3 and AndroidX are Apache-2.0, which is compatible
  with GPL-3.0 and not with GPL-2.0.
- The icon drawings in `assets/source` are mine, under the same licence.
- Every third-party component is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Jukebox is not affiliated with or endorsed by any service it talks to. YouTube
is a trademark of Google LLC. Firefox and Bergamot are Mozilla projects.
MusicBrainz, ListenBrainz and the Cover Art Archive are MetaBrainz Foundation
projects. What you do with a downloader is between you and whoever holds the
rights to what you point it at.
