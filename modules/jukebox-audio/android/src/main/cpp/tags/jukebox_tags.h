/*
 * Reading a file's own details and writing new ones into it. See
 * jukebox_tags.cpp for what is done and why; this is only the shape of it.
 *
 * Nothing here knows about Java. The same two functions are called by the
 * phone through jukebox_tags_jni.cpp and by a computer through
 * jukebox_tags_check.cpp, which is the only place they can be run without one.
 */
#ifndef JUKEBOX_TAGS_H
#define JUKEBOX_TAGS_H

#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace jukebox {

/*
 * What to put in a file. Text is UTF-8.
 *
 * A field left empty is not a field to blank: it is one nobody has an opinion
 * about, and whatever the file says there stays.
 */
struct Details {
  std::optional<std::string> title;
  std::optional<std::string> artist;
  std::optional<std::string> album;
  std::optional<std::string> genre;
  std::optional<int> year;
  std::optional<int> track;
  std::optional<int> disc;
};

/* A picture for the front of the record: its bytes exactly as they are stored. */
struct Cover {
  std::string mime;
  std::string data;
  int width = 0;
  int height = 0;
};

/*
 * What a file says about itself, as a list of names and values.
 *
 * A list rather than a struct because it is carried across to Kotlin as one
 * and compared there, before a write and after it; the names are the contract
 * and are listed where they are made, in jukebox_tags.cpp. `picture` and
 * `other` come once for each picture and each field that is not one of ours.
 */
using Report = std::vector<std::pair<std::string, std::string>>;

/* Reads [path]. False, with [error] saying why, for a file that cannot be. */
bool readTags(const char *path, Report &report, std::string &error);

/*
 * Writes [details], and [cover] if there is one, into the file at [path].
 *
 * [changed] comes back holding the names of what was actually altered -- a
 * field that already said what was asked of it is left alone and not named --
 * and when it comes back empty the file has not been touched at all.
 *
 * The file at [path] is rewritten in place and may be left in any state if
 * this fails. It must never be the user's own: see TagWriter.kt, which hands
 * this a copy and decides afterwards whether the copy is fit to keep.
 */
bool writeTags(const char *path, const Details &details, const Cover *cover,
               std::vector<std::string> &changed, std::string &error);

}  // namespace jukebox

#endif
