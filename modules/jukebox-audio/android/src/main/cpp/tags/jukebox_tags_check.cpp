/*
 * The writing of tags, tried on a computer.
 *
 * The library this goes into is built for a phone, and the unit tests beside
 * the Kotlin run on a desktop JVM that cannot load it. So the part with no
 * Java in it is built once more for whatever machine is doing the building and
 * run here, over files made up on the spot: a few dozen MP3 frames and the
 * front of a FLAC, with "sound" in them that no decoder would thank you for
 * but whose every byte is known. That is the point of making them up -- after
 * a write, the sound can be looked for in the file and must be there whole.
 *
 * Run by `./gradlew :jukebox-audio:checkTagWriter`. It is not part of an
 * ordinary build, which should not need a desktop compiler to make a phone
 * app.
 */
#include "jukebox_tags.h"

#include <attachedpictureframe.h>
#include <commentsframe.h>
#include <flacfile.h>
#include <id3v1tag.h>
#include <id3v2tag.h>
#include <mpegfile.h>
#include <textidentificationframe.h>
#include <xiphcomment.h>

#include <cstdio>
#include <fstream>
#include <iterator>
#include <map>
#include <set>
#include <sstream>

namespace {

int failures = 0;

void expect(bool held, const std::string &what) {
  if (held) return;
  failures++;
  std::fprintf(stderr, "  FAILED: %s\n", what.c_str());
}

std::string slurp(const std::string &path) {
  std::ifstream in(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>()};
}

void spit(const std::string &path, const std::string &bytes) {
  std::ofstream(path, std::ios::binary | std::ios::trunc).write(bytes.data(), static_cast<std::streamsize>(bytes.size()));
}

/* Bytes that are never 0xFF, so nothing in them can be taken for the start of a frame. */
std::string noise(size_t size, unsigned seed) {
  std::string out(size, '\0');
  for (auto &byte : out) {
    seed = seed * 1103515245u + 12345u;
    byte = static_cast<char>((seed >> 16) & 0x7f);
  }
  return out;
}

/* Fifty frames of MPEG-1 layer III at 128 kbit/s: 417 bytes each, header first. */
std::string mp3Sound() {
  std::string out;
  for (unsigned frame = 0; frame < 50; frame++) {
    out += std::string("\xFF\xFB\x90\x64", 4);
    out += noise(413, frame + 1);
  }
  return out;
}

/* The front of a FLAC -- stream info, a block of some application's, padding -- and then "sound". */
std::string flacFile(const std::string &sound) {
  std::string out = "fLaC";
  out += std::string("\x00\x00\x00\x22", 4);
  out += std::string("\x10\x00\x10\x00\x00\x00\x00\x00\x00\x00", 10);  // block and frame sizes
  out += std::string("\x0A\xC4\x42\xF0\x00\x06\xBA\xA8", 8);            // 44.1 kHz, stereo, 16 bit, ten seconds
  out += std::string(16, '\x11');                                       // the MD5 of the sound, as far as anyone knows
  out += std::string("\x02\x00\x00\x0C", 4) + "JUKEsomebody";
  out += std::string("\x81\x00\x00\x10", 4) + std::string(16, '\0');
  return out + sound;
}

std::multiset<std::string> all(const jukebox::Report &report, const std::string &name) {
  std::multiset<std::string> found;
  for (const auto &[key, value] : report) {
    if (key == name) found.insert(value);
  }
  return found;
}

std::string one(const jukebox::Report &report, const std::string &name) {
  const auto found = all(report, name);
  return found.size() == 1 ? *found.begin() : "<" + std::to_string(found.size()) + " values>";
}

jukebox::Report read(const std::string &path) {
  jukebox::Report report;
  std::string error;
  if (!jukebox::readTags(path.c_str(), report, error)) {
    report.clear();
    report.emplace_back("error", error);
  }
  return report;
}

std::string write(const std::string &path, const jukebox::Details &details, const jukebox::Cover *cover) {
  std::vector<std::string> changed;
  std::string error;
  if (!jukebox::writeTags(path.c_str(), details, cover, changed, error)) return "error:" + error;
  std::ostringstream out;
  for (const auto &name : changed) out << name << ",";
  return out.str();
}

jukebox::Cover jpeg(const std::string &body) {
  jukebox::Cover cover;
  cover.mime = "image/jpeg";
  cover.data = std::string("\xFF\xD8\xFF\xE0", 4) + body;
  cover.width = 600;
  cover.height = 600;
  return cover;
}

void bareMp3(const std::string &dir) {
  std::puts("an MP3 with no tag at all");
  const std::string path = dir + "/bare.mp3";
  const std::string sound = mp3Sound();
  spit(path, sound);

  jukebox::Details details;
  details.title = "Yoru ni Kakeru \xE5\xA4\x9C\xE3\x81\xAB\xE9\xA7\x86\xE3\x81\x91\xE3\x82\x8B \xF0\x9F\x8C\x99";
  details.artist = "YOASOBI";
  details.album = "THE BOOK";
  details.genre = "j-pop";
  details.year = 2021;
  details.track = 3;
  details.disc = 1;
  const auto cover = jpeg(noise(5000, 7));
  expect(write(path, details, &cover) == "title,artist,album,genre,year,track,disc,cover,", "every field is reported as changed");

  const auto after = read(path);
  expect(one(after, "format") == "mp3", "it is still an MP3");
  expect(one(after, "id3v2") == "4", "a file with no tag is given v2.4");
  expect(one(after, "id3v1") == "0", "no ID3v1 tag is made where there was none");
  expect(one(after, "title") == *details.title, "the title comes back, emoji and all");
  expect(one(after, "artist") == "YOASOBI" && one(after, "album") == "THE BOOK", "artist and album come back");
  expect(one(after, "genre") == "j-pop", "the genre comes back");
  expect(one(after, "year") == "2021" && one(after, "track") == "3" && one(after, "disc") == "1", "the numbers come back");
  expect(all(after, "picture").size() == 1 && one(after, "picture").rfind("3:5004:", 0) == 0, "one front cover of the right size");

  const std::string bytes = slurp(path);
  expect(bytes.size() > sound.size() && bytes.compare(bytes.size() - sound.size(), sound.size(), sound) == 0,
         "the sound is at the end of the file, whole");

  expect(write(path, details, &cover).empty(), "writing the same again changes nothing");
  expect(slurp(path) == bytes, "and leaves the file byte for byte as it was");
}

void taggedMp3(const std::string &dir) {
  std::puts("an MP3 somebody else tagged, as v2.3 with an old tag at the end");
  const std::string path = dir + "/tagged.mp3";
  const std::string sound = mp3Sound();
  spit(path, sound);
  {
    TagLib::MPEG::File file(path.c_str());
    auto *tag = file.ID3v2Tag(true);
    tag->setTitle("Wrong Title");
    tag->setArtist("Somebody");
    auto *place = new TagLib::ID3v2::TextIdentificationFrame("TRCK", TagLib::String::Latin1);
    place->setText("3/12");
    tag->addFrame(place);
    auto *date = new TagLib::ID3v2::TextIdentificationFrame("TDRC", TagLib::String::Latin1);
    date->setText("1999-05-03");
    tag->addFrame(date);
    auto *gain = new TagLib::ID3v2::UserTextIdentificationFrame(TagLib::String::Latin1);
    gain->setDescription("REPLAYGAIN_TRACK_GAIN");
    gain->setText("-6.50 dB");
    tag->addFrame(gain);
    auto *comment = new TagLib::ID3v2::CommentsFrame(TagLib::String::Latin1);
    comment->setText("ripped on a Tuesday");
    tag->addFrame(comment);
    for (const auto type : {TagLib::ID3v2::AttachedPictureFrame::Other, TagLib::ID3v2::AttachedPictureFrame::BackCover}) {
      auto *picture = new TagLib::ID3v2::AttachedPictureFrame;
      picture->setMimeType("image/png");
      picture->setType(type);
      picture->setPicture(TagLib::ByteVector("\x89PNG old picture", 16));
      tag->addFrame(picture);
    }
    file.ID3v1Tag(true)->setTitle("Wrong Title");
    file.ID3v1Tag()->setYear(1999);
    file.save(TagLib::MPEG::File::ID3v2 | TagLib::MPEG::File::ID3v1, TagLib::File::StripNone,
              TagLib::ID3v2::v3, TagLib::File::DoNotDuplicate);
  }
  const auto before = read(path);
  expect(one(before, "id3v2") == "3" && one(before, "id3v1") == "1", "the file starts as v2.3 with an ID3v1 tag");
  expect(all(before, "other").size() == 2, "it has two frames that are not ours");

  jukebox::Details details;
  details.title = "Right Title";
  details.artist = "Somebody";
  details.year = 1999;
  details.track = 5;
  const auto cover = jpeg(noise(900, 3));
  expect(write(path, details, &cover) == "title,track,cover,", "only what differs is changed");

  const auto after = read(path);
  expect(one(after, "id3v2") == "3", "it is still v2.3");
  expect(one(after, "title") == "Right Title" && one(after, "track") == "5", "the new title and place are there");
  expect(one(after, "artist") == "Somebody" && one(after, "year") == "1999", "what was right is as it was");
  expect(all(after, "other") == all(before, "other"), "the frames that are not ours are untouched");
  expect(all(after, "picture").size() == 2 && all(after, "picture").count(*all(before, "picture").rbegin()) == 1,
         "the picture of the back is kept and the unmarked one replaced");
  expect(one(after, "lengthMs") == one(before, "lengthMs"), "it runs as long as it did");

  TagLib::MPEG::File file(path.c_str());
  expect(file.ID3v2Tag()->frameList("TRCK").front()->toString() == "5/12", "the count of tracks on the record is kept");
  expect(file.ID3v2Tag()->frameList("TDRC").front()->toString().substr(0, 10) == "1999-05-03", "a date that agrees is not cut to its year");
  expect(file.ID3v1Tag()->title() == "Right Title", "the old tag at the end is kept in step");

  const std::string bytes = slurp(path);
  expect(bytes.compare(bytes.size() - 128 - sound.size(), sound.size(), sound) == 0, "the sound is whole, ahead of the old tag");
}

void twoArtists(const std::string &dir) {
  std::puts("an artist kept as two values");
  const std::string path = dir + "/two.mp3";
  spit(path, mp3Sound());
  {
    TagLib::MPEG::File file(path.c_str());
    auto *artist = new TagLib::ID3v2::TextIdentificationFrame("TPE1", TagLib::String::UTF8);
    artist->setText(TagLib::StringList({"Simon", "Garfunkel"}));
    file.ID3v2Tag(true)->addFrame(artist);
    file.save(TagLib::MPEG::File::ID3v2, TagLib::File::StripNone, TagLib::ID3v2::v4, TagLib::File::DoNotDuplicate);
  }
  jukebox::Details details;
  details.artist = "Simon/Garfunkel";
  expect(write(path, details, nullptr).empty(), "the phone's flattening of the two is not written over them");
  details.artist = "Simon & Garfunkel & Friends";
  expect(write(path, details, nullptr) == "artist,", "a different artist is");
}

void flac(const std::string &dir) {
  std::puts("a FLAC");
  const std::string path = dir + "/song.flac";
  const std::string sound = std::string("\xFF\xF8", 2) + noise(20000, 11);
  spit(path, flacFile(sound));
  {
    TagLib::FLAC::File file(path.c_str());
    auto *comment = file.xiphComment(true);
    comment->addField("TITLE", "Wrong");
    comment->addField("TRACKNUMBER", "2/9");
    comment->addField("REPLAYGAIN_TRACK_GAIN", "-7.1 dB");
    comment->addField("COMMENT", "from the CD");
    file.save();
  }
  const auto before = read(path);
  expect(one(before, "format") == "flac" && one(before, "lengthMs") == "10000", "it reads as ten seconds of FLAC");

  jukebox::Details details;
  details.title = "Right \xE2\x9C\x93";
  details.artist = "Somebody";
  details.genre = "shoegaze";
  details.year = 1991;
  details.track = 4;
  details.disc = 2;
  const auto cover = jpeg(noise(3000, 5));
  expect(write(path, details, &cover) == "title,artist,genre,year,track,disc,cover,", "what differs is changed");

  const auto after = read(path);
  expect(one(after, "title") == *details.title && one(after, "artist") == "Somebody", "names come back");
  expect(one(after, "genre") == "shoegaze" && one(after, "year") == "1991", "genre and year come back");
  expect(one(after, "track") == "4" && one(after, "disc") == "2", "places come back");
  expect(all(after, "other") == all(before, "other") && all(after, "other").size() == 2, "other comments are untouched");
  expect(one(after, "picture").rfind("3:3004:", 0) == 0, "one front cover");
  expect(one(after, "lengthMs") == "10000" && one(after, "sampleRate") == "44100", "the sound is described as before");

  TagLib::FLAC::File file(path.c_str());
  expect(file.xiphComment()->fieldListMap()["TRACKNUMBER"].front() == "4/9", "the count of tracks is kept");
  const std::string bytes = slurp(path);
  expect(bytes.compare(bytes.size() - sound.size(), sound.size(), sound) == 0, "the sound is at the end, whole");
  expect(bytes.find("JUKEsomebody") != std::string::npos, "the application's block is still there");
  expect(bytes.find(std::string("\x0A\xC4\x42\xF0\x00\x06\xBA\xA8", 8) + std::string(16, '\x11')) != std::string::npos,
         "the stream info is as it was");

  expect(write(path, details, &cover).empty(), "writing the same again changes nothing");
}

void neither(const std::string &dir) {
  std::puts("something that is neither");
  const std::string path = dir + "/notes.mp3";
  spit(path, "These are not the bytes of a song.\n" + noise(4000, 2));
  expect(one(read(path), "error") != "<0 values>", "reading it says so");
  jukebox::Details details;
  details.title = "Anything";
  expect(write(path, details, nullptr).rfind("error:", 0) == 0, "writing it is refused");
  expect(slurp(path).rfind("These are not", 0) == 0, "and it is left alone");
}

}  // namespace

int main(int argc, char **argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s <an empty directory to work in>\n", argv[0]);
    return 2;
  }
  const std::string dir = argv[1];
  bareMp3(dir);
  taggedMp3(dir);
  twoArtists(dir);
  flac(dir);
  neither(dir);
  if (failures > 0) {
    std::fprintf(stderr, "%d check(s) failed.\n", failures);
    return 1;
  }
  std::puts("The tag writer reads back what it writes and leaves the rest alone.");
  return 0;
}
