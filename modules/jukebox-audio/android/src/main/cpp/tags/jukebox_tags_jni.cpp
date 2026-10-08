/*
 * The way in from Kotlin to jukebox_tags.cpp. See tags/Tags.kt for the other
 * side of it.
 *
 * Text crosses as UTF-16, both ways, and never through JNI's own "UTF"
 * functions. Those speak a dialect of UTF-8 that has no four-byte sequences,
 * so a title with an emoji in it -- which is to say a title -- is either
 * refused by the runtime's checks or quietly turned into something else. A
 * Java string already is UTF-16, and TagLib reads and writes that directly.
 *
 * Nothing here throws into Java. A file that cannot be read is an ordinary
 * answer and comes back as one: a list that says `error`, or a string that
 * begins with it.
 */
#include "jukebox_tags.h"

#include <jni.h>
#include <tbytevector.h>
#include <tstring.h>

#include <string>

namespace {

/* A Java string as UTF-8, which is what the reading and writing are done in. */
std::string fromJava(JNIEnv *env, jstring text) {
  if (!text) return {};
  const jsize length = env->GetStringLength(text);
  const jchar *units = env->GetStringChars(text, nullptr);
  if (!units) return {};
  const TagLib::ByteVector bytes(reinterpret_cast<const char *>(units),
                                 static_cast<unsigned int>(length) * 2);
  env->ReleaseStringChars(text, units);
  return TagLib::String(bytes, TagLib::String::UTF16LE).to8Bit(true);
}

jstring toJava(JNIEnv *env, const std::string &text) {
  const TagLib::ByteVector bytes =
      TagLib::String(text, TagLib::String::UTF8).data(TagLib::String::UTF16LE);
  return env->NewString(reinterpret_cast<const jchar *>(bytes.data()),
                        static_cast<jsize>(bytes.size() / 2));
}

/* One of the seven fields, or nothing where Kotlin sent null. */
std::optional<std::string> textAt(JNIEnv *env, jobjectArray fields, jsize index) {
  auto *value = static_cast<jstring>(env->GetObjectArrayElement(fields, index));
  if (!value) return std::nullopt;
  std::string text = fromJava(env, value);
  env->DeleteLocalRef(value);
  return text;
}

std::optional<int> numberAt(JNIEnv *env, jobjectArray fields, jsize index) {
  const auto text = textAt(env, fields, index);
  if (!text) return std::nullopt;
  try {
    const int number = std::stoi(*text);
    return number > 0 ? std::optional<int>(number) : std::nullopt;
  } catch (...) {
    return std::nullopt;
  }
}

}  // namespace

extern "C" {

/*
 * Names and values, one after the other: [name, value, name, value, ...].
 * A file that cannot be read answers ["error", why].
 */
JNIEXPORT jobjectArray JNICALL
Java_expo_modules_jukeboxaudio_tags_Tags_read(JNIEnv *env, jobject, jstring path) {
  jukebox::Report report;
  std::string error;
  if (!jukebox::readTags(fromJava(env, path).c_str(), report, error)) {
    report.clear();
    report.emplace_back("error", error);
  }

  jclass strings = env->FindClass("java/lang/String");
  if (!strings) return nullptr;
  jobjectArray out = env->NewObjectArray(static_cast<jsize>(report.size() * 2), strings, nullptr);
  if (!out) return nullptr;
  jsize at = 0;
  for (const auto &[name, value] : report) {
    for (const std::string *text : {&name, &value}) {
      jstring made = toJava(env, *text);
      if (!made) return nullptr;
      env->SetObjectArrayElement(out, at++, made);
      // A report can run to hundreds of entries and a native frame is only
      // promised room for sixteen references.
      env->DeleteLocalRef(made);
    }
  }
  return out;
}

/*
 * [fields] is title, artist, album, genre, year, track, disc, in that order,
 * each one null where it is to be left alone. Answers "changed:" followed by
 * the names of what was altered, separated by commas -- nothing after the
 * colon when the file already said all of it -- or "error:" and why.
 */
JNIEXPORT jstring JNICALL
Java_expo_modules_jukeboxaudio_tags_Tags_write(JNIEnv *env, jobject, jstring path,
                                               jobjectArray fields, jbyteArray picture,
                                               jstring mime, jint width, jint height) {
  if (!fields || env->GetArrayLength(fields) != 7) {
    return toJava(env, "error:The details were not handed over in the shape expected.");
  }
  jukebox::Details details;
  details.title = textAt(env, fields, 0);
  details.artist = textAt(env, fields, 1);
  details.album = textAt(env, fields, 2);
  details.genre = textAt(env, fields, 3);
  details.year = numberAt(env, fields, 4);
  details.track = numberAt(env, fields, 5);
  details.disc = numberAt(env, fields, 6);

  jukebox::Cover cover;
  bool covered = false;
  if (picture) {
    const jsize size = env->GetArrayLength(picture);
    cover.data.resize(static_cast<size_t>(size));
    env->GetByteArrayRegion(picture, 0, size, reinterpret_cast<jbyte *>(cover.data.data()));
    cover.mime = fromJava(env, mime);
    cover.width = width;
    cover.height = height;
    covered = size > 0;
  }

  std::vector<std::string> changed;
  std::string error;
  if (!jukebox::writeTags(fromJava(env, path).c_str(), details, covered ? &cover : nullptr,
                          changed, error)) {
    return toJava(env, "error:" + error);
  }
  std::string answer = "changed:";
  for (size_t index = 0; index < changed.size(); index++) {
    if (index > 0) answer += ",";
    answer += changed[index];
  }
  return toJava(env, answer);
}

}  // extern "C"
