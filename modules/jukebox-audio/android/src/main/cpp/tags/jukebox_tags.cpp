/*
 * A file's own details: what it says, and saying something else.
 *
 * For MP3 that is the ID3v2 tag at the front, and for FLAC the Vorbis comment
 * and picture blocks before the sound. Nothing else is opened. The phone is
 * full of other things with tags in them and each has its own way of going
 * wrong; these two are what a music library is made of, and a writer that is
 * careful with two formats is worth more than one that will have a go at ten.
 *
 * Three rules run through all of it.
 *
 * Only what was asked for is written, and only where it is not already so. A
 * field that already says what the app shows is left exactly as it is, down to
 * the encoding it was written in, and if that is true of every field the file
 * is not rewritten at all. "Already says" is read generously: an artist kept
 * as two values is what the phone shows as "A/B" or "A, B" or plain "A", and
 * writing that back over the two would be losing something to change nothing.
 *
 * Nothing that is not ours is removed. ReplayGain, comments, lyrics, ratings,
 * a second picture of the back of the sleeve: the tag is edited, not rebuilt.
 *
 * The version an ID3 tag already has is the version it keeps. A great many car
 * stereos and older players read v2.3 and nothing later, and a file that
 * played in the car yesterday must play there tomorrow. A file with no tag of
 * its own, or one older than v2.3, is given v2.4.
 *
 * TagLib does the reading and the rendering. It is by Scott Wheeler and
 * others, under the LGPL 2.1 or the MPL 1.1, and is fetched by the build at a
 * pinned commit rather than kept here; see build.gradle.
 */
#include "jukebox_tags.h"

#include <attachedpictureframe.h>
#include <flacfile.h>
#include <flacpicture.h>
#include <id3v1tag.h>
#include <id3v2frame.h>
#include <id3v2header.h>
#include <id3v2tag.h>
#include <mpegfile.h>
#include <textidentificationframe.h>
#include <tfilestream.h>
#include <tstringlist.h>
#include <xiphcomment.h>

#include <zlib.h>

#include <algorithm>
#include <exception>

using TagLib::ByteVector;
using TagLib::String;
using TagLib::StringList;

namespace jukebox {
namespace {

enum class Format { None, Mp3, Flac };

/*
 * By what is in it, not by what it is called. A name is a claim, and the
 * claim that matters here is the one the bytes make: an .mp3 that is really
 * something else would be "tagged" by prepending a header to a file no MP3
 * reader was ever going to open.
 *
 * FLAC is asked first because a FLAC with an ID3 tag stuck on the front of it
 * -- which exists, and is wrong, and plays -- begins exactly as an MP3 does.
 */
Format formatOf(const char *path) {
  TagLib::FileStream stream(path, true);
  if (!stream.isOpen()) return Format::None;
  if (TagLib::FLAC::File::isSupported(&stream)) return Format::Flac;
  stream.seek(0);
  if (TagLib::MPEG::File::isSupported(&stream)) return Format::Mp3;
  return Format::None;
}

String utf8(const std::string &text) { return String(text, String::UTF8); }

std::string plain(const String &text) { return text.to8Bit(true); }

/* A fingerprint of some bytes, small enough to carry in a report. */
std::string crcOf(const char *data, size_t size) {
  const uLong crc = crc32(crc32(0L, Z_NULL, 0), reinterpret_cast<const Bytef *>(data),
                          static_cast<uInt>(size));
  return std::to_string(static_cast<unsigned long>(crc));
}

std::string crcOf(const ByteVector &bytes) { return crcOf(bytes.data(), bytes.size()); }

std::string crcOf(const String &text) {
  const std::string bytes = plain(text);
  return crcOf(bytes.data(), bytes.size());
}

/* How a picture is named in a report: what it is of, how big, and its fingerprint. */
std::string pictureLine(int type, const ByteVector &data) {
  return std::to_string(type) + ":" + std::to_string(data.size()) + ":" + crcOf(data);
}

/*
 * Whether several values already amount to what is being asked for.
 *
 * The app shows what the phone's media store made of the file, and the store
 * flattens a list its own way. Any of the usual flattenings, or the first
 * value alone, counts as the file already saying it.
 */
bool says(const StringList &values, const String &wanted) {
  if (values.isEmpty()) return false;
  if (values.front() == wanted) return true;
  for (const char *separator : {" ", "/", " / ", ", ", "; ", ";", " & "}) {
    if (values.toString(separator) == wanted) return true;
  }
  return false;
}

/* "3/12" with a new 3: the count of the whole record is not ours to drop. */
String placed(int number, const String &was) {
  const int slash = was.find("/");
  return slash < 0 ? String::number(number) : String::number(number) + was.substr(slash);
}

/*
 * Which pictures a new cover takes the place of.
 *
 * The front covers, if there are any. If there are none, the pictures marked
 * as nothing in particular: a great many taggers file the cover under "other"
 * and every player shows it as the cover anyway, so adding a front cover next
 * to it would leave the file with two and no saying which one is drawn.
 * Anything marked as something else -- the back, the disc, the band -- stays.
 */
template <typename Picture, typename TypeOf>
std::vector<Picture> coversAmong(const std::vector<Picture> &pictures, TypeOf typeOf) {
  for (const int wanted : {3, 0}) {
    std::vector<Picture> found;
    for (const auto &picture : pictures) {
      if (typeOf(picture) == wanted) found.push_back(picture);
    }
    if (!found.empty()) return found;
  }
  return {};
}

// ---- ID3v2 ----

using TagLib::ID3v2::AttachedPictureFrame;
using TagLib::ID3v2::TextIdentificationFrame;

/*
 * The frames this writes. Everything else in a tag is somebody else's.
 *
 * TDAT and TIME are the day and the hour of a v2.3 date, which TagLib folds
 * into the one date it keeps and unfolds again on the way out. They go where
 * the year goes: a date given a different year has no day left to keep.
 */
const char *const OWN_FRAMES[] = {"TIT2", "TPE1", "TALB", "TCON", "TDRC", "TDAT", "TIME",
                                  "TRCK", "TPOS", "APIC"};

bool own(const ByteVector &id) {
  return std::any_of(std::begin(OWN_FRAMES), std::end(OWN_FRAMES),
                     [&id](const char *mine) { return id == mine; });
}

StringList valuesOf(TagLib::ID3v2::Tag *tag, const char *id) {
  const auto &frames = tag->frameList(id);
  if (frames.isEmpty()) return {};
  if (auto *text = dynamic_cast<TextIdentificationFrame *>(frames.front())) return text->fieldList();
  return StringList(frames.front()->toString());
}

String textOf(TagLib::ID3v2::Tag *tag, const char *id) {
  const StringList values = valuesOf(tag, id);
  return values.isEmpty() ? String() : values.toString(" ");
}

/*
 * Latin-1 where the text fits in it and UTF-8 where it does not. TagLib turns
 * the UTF-8 into UTF-16 by itself when the tag is v2.3, which has no UTF-8;
 * and Latin-1, which both versions have, is the one encoding even the oldest
 * player in the oldest car gets right.
 */
void putText(TagLib::ID3v2::Tag *tag, const char *id, const String &value) {
  tag->removeFrames(id);
  auto *frame = new TextIdentificationFrame(
      id, value.isLatin1() ? String::Latin1 : String::UTF8);
  frame->setText(value);
  tag->addFrame(frame);
}

bool setText(TagLib::ID3v2::Tag *tag, const char *id, const String &value) {
  if (says(valuesOf(tag, id), value)) return false;
  putText(tag, id, value);
  return true;
}

std::vector<AttachedPictureFrame *> picturesOf(TagLib::ID3v2::Tag *tag) {
  std::vector<AttachedPictureFrame *> pictures;
  for (auto *frame : tag->frameList("APIC")) {
    if (auto *picture = dynamic_cast<AttachedPictureFrame *>(frame)) pictures.push_back(picture);
  }
  return pictures;
}

bool setCover(TagLib::ID3v2::Tag *tag, const Cover &cover) {
  const ByteVector data(cover.data.data(), static_cast<unsigned int>(cover.data.size()));
  const auto replaced = coversAmong(
      picturesOf(tag), [](AttachedPictureFrame *picture) { return static_cast<int>(picture->type()); });
  if (replaced.size() == 1 && replaced.front()->type() == AttachedPictureFrame::FrontCover &&
      replaced.front()->picture() == data) {
    return false;
  }
  for (auto *picture : replaced) tag->removeFrame(picture, true);

  auto *frame = new AttachedPictureFrame;
  frame->setMimeType(utf8(cover.mime));
  frame->setType(AttachedPictureFrame::FrontCover);
  frame->setPicture(data);
  tag->addFrame(frame);
  return true;
}

void describe(TagLib::ID3v2::Tag *tag, Report &report) {
  report.emplace_back("title", plain(textOf(tag, "TIT2")));
  report.emplace_back("artist", plain(textOf(tag, "TPE1")));
  report.emplace_back("album", plain(textOf(tag, "TALB")));
  report.emplace_back("genre", plain(tag->genre()));
  report.emplace_back("year", std::to_string(tag->year()));
  report.emplace_back("track", std::to_string(tag->track()));
  report.emplace_back("disc", std::to_string(textOf(tag, "TPOS").toInt()));
  for (auto *picture : picturesOf(tag)) {
    report.emplace_back("picture", pictureLine(static_cast<int>(picture->type()), picture->picture()));
  }
  for (auto *frame : tag->frameList()) {
    const ByteVector id = frame->frameID();
    if (own(id)) continue;
    report.emplace_back("other", plain(String(id)) + ":" + crcOf(frame->toString()));
  }
}

bool readMp3(const char *path, Report &report, std::string &error) {
  TagLib::MPEG::File file(path, true, TagLib::AudioProperties::Accurate);
  if (!file.isValid() || !file.audioProperties()) {
    error = "It could not be read as an MP3.";
    return false;
  }
  report.emplace_back("format", "mp3");
  const auto *sound = file.audioProperties();
  report.emplace_back("lengthMs", std::to_string(sound->lengthInMilliseconds()));
  report.emplace_back("sampleRate", std::to_string(sound->sampleRate()));
  report.emplace_back("channels", std::to_string(sound->channels()));
  report.emplace_back("id3v2", std::to_string(
      file.hasID3v2Tag() ? static_cast<int>(file.ID3v2Tag()->header()->majorVersion()) : 0));
  report.emplace_back("id3v1", file.hasID3v1Tag() ? "1" : "0");
  describe(file.ID3v2Tag(true), report);
  return true;
}

/*
 * The old tag at the end of the file, kept in step where there is one.
 *
 * Thirty Latin-1 characters a field, so only what will go into it is put
 * there: a title in Japanese would arrive as a row of question marks, which
 * is worse than the old title it replaced. Never created where there is none.
 */
void keepInStep(TagLib::ID3v1::Tag *old, const Details &details,
                const std::vector<std::string> &changed) {
  const auto was = [&changed](const char *name) {
    return std::find(changed.begin(), changed.end(), name) != changed.end();
  };
  const auto fits = [](const std::optional<std::string> &text) {
    return text && utf8(*text).isLatin1();
  };
  if (was("title") && fits(details.title)) old->setTitle(utf8(*details.title));
  if (was("artist") && fits(details.artist)) old->setArtist(utf8(*details.artist));
  if (was("album") && fits(details.album)) old->setAlbum(utf8(*details.album));
  if (was("genre") && fits(details.genre)) old->setGenre(utf8(*details.genre));
  if (was("year") && details.year) old->setYear(static_cast<unsigned int>(*details.year));
  if (was("track") && details.track && *details.track < 256) {
    old->setTrack(static_cast<unsigned int>(*details.track));
  }
}

bool writeMp3(const char *path, const Details &details, const Cover *cover,
              std::vector<std::string> &changed, std::string &error) {
  TagLib::MPEG::File file(path, true, TagLib::AudioProperties::Accurate);
  if (!file.isValid() || !file.audioProperties()) {
    error = "It could not be read as an MP3.";
    return false;
  }
  if (file.readOnly()) {
    error = "The working copy could not be opened for writing.";
    return false;
  }

  // Asked before anything is added, because afterwards there is always a tag.
  const bool v23 = file.hasID3v2Tag() && file.ID3v2Tag()->header()->majorVersion() == 3;
  auto *tag = file.ID3v2Tag(true);

  if (details.title && setText(tag, "TIT2", utf8(*details.title))) changed.push_back("title");
  if (details.artist && setText(tag, "TPE1", utf8(*details.artist))) changed.push_back("artist");
  if (details.album && setText(tag, "TALB", utf8(*details.album))) changed.push_back("album");
  // Through genre() and not the frame's own text, which may be a number in
  // brackets from the list ID3v1 had: "(17)" already says Rock.
  if (details.genre && tag->genre() != utf8(*details.genre)) {
    putText(tag, "TCON", utf8(*details.genre));
    changed.push_back("genre");
  }
  // Only when the year itself is different. A date written out to the day
  // would otherwise be cut down to its year for agreeing with it.
  if (details.year && static_cast<int>(tag->year()) != *details.year) {
    putText(tag, "TDRC", String::number(*details.year));
    changed.push_back("year");
  }
  if (details.track && static_cast<int>(tag->track()) != *details.track) {
    putText(tag, "TRCK", placed(*details.track, textOf(tag, "TRCK")));
    changed.push_back("track");
  }
  if (details.disc && textOf(tag, "TPOS").toInt() != *details.disc) {
    putText(tag, "TPOS", placed(*details.disc, textOf(tag, "TPOS")));
    changed.push_back("disc");
  }
  if (cover && setCover(tag, *cover)) changed.push_back("cover");

  if (changed.empty()) return true;

  int tags = TagLib::MPEG::File::ID3v2;
  if (file.hasID3v1Tag()) {
    keepInStep(file.ID3v1Tag(), details, changed);
    tags |= TagLib::MPEG::File::ID3v1;
  }
  // Strip nothing and copy nothing: the tags named are written and whatever
  // else is in the file -- an APE tag, say -- is not so much as looked at.
  if (!file.save(tags, TagLib::File::StripNone,
                 v23 ? TagLib::ID3v2::v3 : TagLib::ID3v2::v4, TagLib::File::DoNotDuplicate)) {
    error = "The new details could not be written into the working copy.";
    return false;
  }
  return true;
}

// ---- FLAC ----

/* The comments this writes. Every other comment in the block is left as found. */
const char *const OWN_FIELDS[] = {"TITLE", "ARTIST", "ALBUM", "GENRE", "DATE", "TRACKNUMBER", "DISCNUMBER"};

String fieldOf(TagLib::Ogg::XiphComment *comment, const char *key) {
  const StringList values = comment->fieldListMap().value(key);
  return values.isEmpty() ? String() : values.toString(" ");
}

bool setField(TagLib::Ogg::XiphComment *comment, const char *key, const String &value) {
  if (says(comment->fieldListMap().value(key), value)) return false;
  comment->addField(key, value, true);
  return true;
}

std::vector<TagLib::FLAC::Picture *> picturesOf(TagLib::FLAC::File &file) {
  std::vector<TagLib::FLAC::Picture *> pictures;
  for (auto *picture : file.pictureList()) pictures.push_back(picture);
  return pictures;
}

bool setCover(TagLib::FLAC::File &file, const Cover &cover) {
  const ByteVector data(cover.data.data(), static_cast<unsigned int>(cover.data.size()));
  const auto replaced = coversAmong(
      picturesOf(file), [](TagLib::FLAC::Picture *picture) { return static_cast<int>(picture->type()); });
  if (replaced.size() == 1 && replaced.front()->type() == TagLib::FLAC::Picture::FrontCover &&
      replaced.front()->data() == data) {
    return false;
  }
  for (auto *picture : replaced) file.removePicture(picture, true);

  auto *picture = new TagLib::FLAC::Picture;
  picture->setType(TagLib::FLAC::Picture::FrontCover);
  picture->setMimeType(utf8(cover.mime));
  picture->setWidth(cover.width);
  picture->setHeight(cover.height);
  // Three bytes a pixel for a JPEG; a PNG may have a fourth, and nothing that
  // reads this field draws the picture any differently for being told.
  picture->setColorDepth(24);
  picture->setData(data);
  file.addPicture(picture);
  return true;
}

bool readFlac(const char *path, Report &report, std::string &error) {
  TagLib::FLAC::File file(path, true, TagLib::AudioProperties::Accurate);
  if (!file.isValid() || !file.audioProperties()) {
    error = "It could not be read as a FLAC.";
    return false;
  }
  report.emplace_back("format", "flac");
  const auto *sound = file.audioProperties();
  report.emplace_back("lengthMs", std::to_string(sound->lengthInMilliseconds()));
  report.emplace_back("sampleRate", std::to_string(sound->sampleRate()));
  report.emplace_back("channels", std::to_string(sound->channels()));
  report.emplace_back("id3v2", "0");
  report.emplace_back("id3v1", file.hasID3v1Tag() ? "1" : "0");

  auto *comment = file.xiphComment(true);
  report.emplace_back("title", plain(fieldOf(comment, "TITLE")));
  report.emplace_back("artist", plain(fieldOf(comment, "ARTIST")));
  report.emplace_back("album", plain(fieldOf(comment, "ALBUM")));
  report.emplace_back("genre", plain(fieldOf(comment, "GENRE")));
  report.emplace_back("year", std::to_string(fieldOf(comment, "DATE").substr(0, 4).toInt()));
  report.emplace_back("track", std::to_string(fieldOf(comment, "TRACKNUMBER").toInt()));
  report.emplace_back("disc", std::to_string(fieldOf(comment, "DISCNUMBER").toInt()));
  for (auto *picture : picturesOf(file)) {
    report.emplace_back("picture", pictureLine(static_cast<int>(picture->type()), picture->data()));
  }
  for (const auto &[key, values] : comment->fieldListMap()) {
    if (std::any_of(std::begin(OWN_FIELDS), std::end(OWN_FIELDS),
                    [&key = key](const char *mine) { return key == mine; })) {
      continue;
    }
    report.emplace_back("other", plain(key) + ":" + crcOf(values.toString("\x1f")));
  }
  return true;
}

bool writeFlac(const char *path, const Details &details, const Cover *cover,
               std::vector<std::string> &changed, std::string &error) {
  TagLib::FLAC::File file(path, true, TagLib::AudioProperties::Accurate);
  if (!file.isValid() || !file.audioProperties()) {
    error = "It could not be read as a FLAC.";
    return false;
  }
  if (file.readOnly()) {
    error = "The working copy could not be opened for writing.";
    return false;
  }

  auto *comment = file.xiphComment(true);
  if (details.title && setField(comment, "TITLE", utf8(*details.title))) changed.push_back("title");
  if (details.artist && setField(comment, "ARTIST", utf8(*details.artist))) changed.push_back("artist");
  if (details.album && setField(comment, "ALBUM", utf8(*details.album))) changed.push_back("album");
  if (details.genre && setField(comment, "GENRE", utf8(*details.genre))) changed.push_back("genre");
  if (details.year && fieldOf(comment, "DATE").substr(0, 4).toInt() != *details.year) {
    comment->addField("DATE", String::number(*details.year), true);
    changed.push_back("year");
  }
  if (details.track && fieldOf(comment, "TRACKNUMBER").toInt() != *details.track) {
    comment->addField("TRACKNUMBER", placed(*details.track, fieldOf(comment, "TRACKNUMBER")), true);
    changed.push_back("track");
  }
  if (details.disc && fieldOf(comment, "DISCNUMBER").toInt() != *details.disc) {
    comment->addField("DISCNUMBER", placed(*details.disc, fieldOf(comment, "DISCNUMBER")), true);
    changed.push_back("disc");
  }
  if (cover && setCover(file, *cover)) changed.push_back("cover");

  if (changed.empty()) return true;
  if (!file.save()) {
    error = "The new details could not be written into the working copy.";
    return false;
  }
  return true;
}

}  // namespace

bool readTags(const char *path, Report &report, std::string &error) {
  try {
    switch (formatOf(path)) {
      case Format::Mp3: return readMp3(path, report, error);
      case Format::Flac: return readFlac(path, report, error);
      case Format::None: break;
    }
    error = "It is neither an MP3 nor a FLAC.";
  } catch (const std::exception &failure) {
    error = failure.what();
  }
  return false;
}

bool writeTags(const char *path, const Details &details, const Cover *cover,
               std::vector<std::string> &changed, std::string &error) {
  changed.clear();
  try {
    switch (formatOf(path)) {
      case Format::Mp3: return writeMp3(path, details, cover, changed, error);
      case Format::Flac: return writeFlac(path, details, cover, changed, error);
      case Format::None: break;
    }
    error = "It is neither an MP3 nor a FLAC.";
  } catch (const std::exception &failure) {
    error = failure.what();
  }
  return false;
}

}  // namespace jukebox
