/*
 * The words a file carries for its own song.
 *
 * Read only, and from any kind of file TagLib is built to open here rather
 * than only the two the writer will touch: reading cannot hurt a file, and the
 * phone's music is full of M4As from one shop and Opus files from another.
 * What is looked for, by the name each format gives it:
 *
 *   MP3 ........ USLT (one per language or description) and SYLT, the timed
 *                one, in the ID3v2 tag; "Lyrics" in an APE tag, which some
 *                Windows taggers leave at the end of an MP3 as well
 *   FLAC, Ogg .. LYRICS, UNSYNCEDLYRICS and SYNCEDLYRICS in the comments
 *   M4A ........ the ©lyr atom
 *   APE, MPC,
 *   WavPack .... "Lyrics" in the APE tag
 *
 * Nothing is decided here about what the words are. A LYRICS field may hold
 * LRC with its timestamps as easily as a plain verse, and the app already
 * knows how to tell, in TypeScript where it can be tested
 * (src/lib/lyrics/local.ts); this only hands over everything it found, in the
 * order it was found.
 *
 * The file is reached by a descriptor and not by a path. The media store hands
 * the app a descriptor for any song it may play, and that is all that is
 * needed to read one: no copy, as the writer makes, because nothing is going
 * to be written.
 */
#include "jukebox_tags.h"

#include <apetag.h>
#include <fileref.h>
#include <id3v2tag.h>
#include <mpegfile.h>
#include <synchronizedlyricsframe.h>
#include <tfilestream.h>
#include <tpropertymap.h>
#include <tstringlist.h>

#include <unistd.h>

#include <exception>

using TagLib::String;

namespace jukebox {
namespace {

/*
 * The names a field of words goes by, in the order they are reported. TagLib
 * gives every format's own name for lyrics as LYRICS -- USLT, ©lyr and an APE
 * tag's "Lyrics" alike -- and passes the comment fields of FLAC and Ogg
 * through as they are written, which is where the other three come from.
 */
const char *const NAMES[] = {"LYRICS", "UNSYNCEDLYRICS", "UNSYNCED LYRICS", "SYNCEDLYRICS"};

std::string plain(const String &text) { return text.to8Bit(true); }

void wordsIn(const TagLib::PropertyMap &properties, Report &report) {
  for (const char *name : NAMES) {
    for (const auto &value : properties.value(name)) {
      if (!value.isEmpty()) report.emplace_back("text", plain(value));
    }
  }
  // A USLT with a description of its own is named for it: "LYRICS:English",
  // say. Read after the plain ones, which are the more likely to be the song.
  for (const auto &[name, values] : properties) {
    if (!name.startsWith("LYRICS:")) continue;
    for (const auto &value : values) {
      if (!value.isEmpty()) report.emplace_back("text", plain(value));
    }
  }
}

/*
 * The first SYLT frame that is words timed in milliseconds, one entry a line
 * as "milliseconds, a tab, the text".
 *
 * The text goes as it is, a newline at its front included: a karaoke tagger
 * writes a syllable to an entry and marks where each line begins that way, and
 * whoever puts the lines back together has to be able to see it. Timings
 * counted in MPEG frames are left out; turning them into time needs the
 * frame length, and a file that does it this way is rare enough to be read
 * as not having timed words at all.
 */
void timedIn(TagLib::ID3v2::Tag *tag, Report &report) {
  using TagLib::ID3v2::SynchronizedLyricsFrame;
  for (auto *frame : tag->frameList("SYLT")) {
    auto *timed = dynamic_cast<SynchronizedLyricsFrame *>(frame);
    if (!timed || timed->timestampFormat() != SynchronizedLyricsFrame::AbsoluteMilliseconds) continue;
    const auto type = timed->type();
    if (type != SynchronizedLyricsFrame::Lyrics && type != SynchronizedLyricsFrame::TextTranscription &&
        type != SynchronizedLyricsFrame::Other) {
      continue;
    }
    const auto entries = timed->synchedText();
    if (entries.isEmpty()) continue;
    for (const auto &entry : entries) {
      report.emplace_back("sylt", std::to_string(entry.time) + "\t" + plain(entry.text));
    }
    return;
  }
}

}  // namespace

bool readLyrics(int fd, Report &report, std::string &error) {
  try {
    // From here the descriptor is the stream's, and closing the stream closes it.
    TagLib::FileStream stream(fd, true);
    if (!stream.isOpen()) {
      ::close(fd);
      error = "The file could not be opened.";
      return false;
    }
    // Without the length and the rest: only the tags are wanted, and working
    // out how long a song runs can mean reading a good deal more of it.
    const TagLib::FileRef ref(&stream, false);
    if (ref.isNull()) {
      error = "It is not a kind of file whose words can be read.";
      return false;
    }
    if (auto *mpeg = dynamic_cast<TagLib::MPEG::File *>(ref.file())) {
      // Each tag asked separately. Asked as a whole, an MP3 answers with the
      // first tag that has anything in it, and words in an APE tag behind an
      // ID3v2 tag with only a title in it would never be seen.
      if (mpeg->hasID3v2Tag()) {
        timedIn(mpeg->ID3v2Tag(), report);
        wordsIn(mpeg->ID3v2Tag()->properties(), report);
      }
      if (mpeg->hasAPETag()) wordsIn(mpeg->APETag()->properties(), report);
    } else {
      wordsIn(ref.file()->properties(), report);
    }
    return true;
  } catch (const std::exception &failure) {
    error = failure.what();
  }
  return false;
}

}  // namespace jukebox
