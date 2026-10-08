package expo.modules.jukeboxaudio.downloads

import androidx.annotation.StringRes
import expo.modules.jukeboxaudio.Localised
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Words
import expo.modules.kotlin.exception.CodedException

/**
 * The ways a search or a download goes wrong that there is a sentence for.
 *
 * Each has two things: a code, and the words. JavaScript used to recognise
 * these by looking for pieces of the English sentence — "update Jukebox",
 * "unavailable" — which stops working the moment the sentence is said in
 * another language. The code is what it should recognise instead: it is the
 * same in every language and in every version, and never shown to anyone.
 *
 * Where each travels:
 *
 * A call that is refused throws [YouTubeTrouble], and JavaScript finds the
 * code as the error's `code`. Its `message` is still the English sentence,
 * whatever the app is in, so that a screen which has not yet been moved over
 * to the codes goes on recognising what it always did. Nothing is lost by
 * that: those screens show a sentence of their own, not this one.
 *
 * A download that fails is written into its job, as `errorCode` beside the
 * `error` that was always there. `error` stays English for the same reason,
 * and a third field, `errorText`, is the sentence in the app's language as it
 * is at the moment the jobs are read — see [DownloadStore.list].
 */
enum class Failure(val code: String, @StringRes val words: Int) {
  VERIFICATION("ERR_YOUTUBE_VERIFICATION", R.string.jukebox_youtube_verification),
  UNAVAILABLE("ERR_YOUTUBE_UNAVAILABLE", R.string.jukebox_youtube_unavailable),
  /** YouTube's pages have moved on from the extractor in this build. A newer build is the only cure. */
  OUTDATED("ERR_YOUTUBE_OUTDATED", R.string.jukebox_youtube_outdated),
  NETWORK("ERR_YOUTUBE_NETWORK", R.string.jukebox_youtube_network),
  REFUSED("ERR_YOUTUBE_REFUSED", R.string.jukebox_youtube_refused),
  TIMED_OUT("ERR_YOUTUBE_TIMED_OUT", R.string.jukebox_youtube_timed_out),
  LIVE("ERR_YOUTUBE_LIVE", R.string.jukebox_youtube_live),
  TOO_LONG("ERR_YOUTUBE_TOO_LONG", R.string.jukebox_youtube_too_long),
  NO_AUDIO("ERR_YOUTUBE_NO_AUDIO", R.string.jukebox_youtube_no_audio),
  ENGINE("ERR_YOUTUBE_ENGINE", R.string.jukebox_youtube_engine),

  // What was typed or pasted is not something that can be looked for.
  INVALID_VIDEO("ERR_YOUTUBE_INVALID_VIDEO", R.string.jukebox_youtube_invalid_video),
  QUERY("ERR_YOUTUBE_QUERY", R.string.jukebox_youtube_query),
  VIDEO_LINK("ERR_YOUTUBE_VIDEO_LINK", R.string.jukebox_youtube_video_link),
  NOT_A_VIDEO("ERR_YOUTUBE_NOT_A_VIDEO", R.string.jukebox_youtube_not_a_video),
  PLAYLIST_QUERY("ERR_YOUTUBE_PLAYLIST_QUERY", R.string.jukebox_youtube_playlist_query),
  PLAYLIST_LINK("ERR_YOUTUBE_PLAYLIST_LINK", R.string.jukebox_youtube_playlist_link),
  NO_PLAYLIST("ERR_YOUTUBE_NO_PLAYLIST", R.string.jukebox_youtube_no_playlist),

  // The queue, and the service that works through it.
  FOLDER("ERR_DOWNLOAD_FOLDER", R.string.jukebox_download_folder),
  QUEUE_FULL("ERR_DOWNLOAD_QUEUE_FULL", R.string.jukebox_download_queue_full),
  BATCH("ERR_DOWNLOAD_BATCH", R.string.jukebox_download_batch),
  WAITING_WIFI("ERR_DOWNLOAD_WAITING_WIFI", R.string.jukebox_download_waiting_wifi),
  PAUSED("ERR_DOWNLOAD_PAUSED", R.string.jukebox_download_paused),
  INTERRUPTED("ERR_DOWNLOAD_INTERRUPTED", R.string.jukebox_download_interrupted),
  STOPPED("ERR_DOWNLOAD_STOPPED", R.string.jukebox_download_stopped),
  SERVICE("ERR_DOWNLOAD_SERVICE", R.string.jukebox_download_service),
  OPEN_SEARCH("ERR_DOWNLOAD_OPEN_SEARCH", R.string.jukebox_download_open_search),
  OPEN_DISCOVER("ERR_DOWNLOAD_OPEN_DISCOVER", R.string.jukebox_download_open_discover),
  RETRY_DISCOVER("ERR_DOWNLOAD_RETRY_DISCOVER", R.string.jukebox_download_retry_discover),
  NOT_HERE("ERR_DOWNLOAD_NOT_HERE", R.string.jukebox_download_not_here),
  /**
   * A job asked for by name, and none of what the search turned up is that
   * recording. Nothing went wrong, and trying again will find the same.
   */
  NO_MATCH("ERR_DOWNLOAD_NO_MATCH", R.string.jukebox_download_no_match),

  /**
   * Anything else. The one kind that may come with words of its own: the
   * last line of what the extractor said, which is in English because the
   * extractor is, and is at least about the thing that went wrong.
   */
  FAILED("ERR_DOWNLOAD_FAILED", R.string.jukebox_download_failed);

  /** The sentence in English, for the road JavaScript still reads by its wording. */
  val english: String get() = Localised.saidInEnglish(Words(words)) ?: code

  /** The sentence in the app's language. */
  val said: String get() = Localised.said(Words(words)) ?: code

  companion object {
    fun of(code: String?): Failure? = values().firstOrNull { it.code == code }

    /** The failure an English sentence was, for a job written down before there were codes. */
    fun saying(sentence: String?): Failure? =
      if (sentence.isNullOrBlank()) null else values().firstOrNull { it.english == sentence }
  }
}

/** A failure as it happened: which, and for [Failure.FAILED] alone, what was said. */
class Failed(val failure: Failure, val detail: String? = null) {
  val english: String get() = detail ?: failure.english
}

/**
 * A refusal that crosses to JavaScript with its code.
 *
 * A CodedException because that is the one kind Expo passes on with a code of
 * its own choosing rather than one made out of the class name.
 */
class YouTubeTrouble(
  val failure: Failure,
  val detail: String? = null,
  cause: Throwable? = null
) : CodedException(failure.code, null, cause) {
  // Asked for late, like [expo.modules.jukeboxaudio.Told]'s, and English on
  // purpose: see [Failure].
  override val message: String
    get() = detail ?: failure.english
}

/**
 * A search asked for on the queue's behalf that is not to be made, or was
 * put off: the job is not the one whose turn it is, or somebody typed a
 * search of their own. Never shown. The queue has already written down what
 * becomes of the job, and whoever asked only has to ask it what is next.
 */
class NotItsTurn(cause: Throwable? = null) :
  CodedException("ERR_DOWNLOAD_NOT_ITS_TURN", "It is not this search's turn.", cause)

/** As a word: "both", "robot" and "bottom" are in other errors and are not about verification. */
private val BOT = Regex("\\bbot\\b", RegexOption.IGNORE_CASE)

/**
 * What yt-dlp says when YouTube's pages have moved on from the copy bundled
 * here. Nothing the listener does to the request helps; a newer build does.
 */
private val OUTDATED = Regex(
  "Unable to extract|Signature extraction failed|nsig extraction failed|Failed to (?:parse|extract)|Please report this issue",
  RegexOption.IGNORE_CASE
)

/**
 * Which failure [error] is.
 *
 * One this module threw says so itself, wherever in the chain of causes it
 * is. Anything else is the extractor's, or the network's, and is recognised
 * by what it says — in English, which is the only language either speaks.
 */
fun failed(error: Throwable): Failed {
  generateSequence(error) { it.cause }.take(8).filterIsInstance<YouTubeTrouble>().firstOrNull()
    ?.let { return Failed(it.failure, it.detail) }

  val text = error.message.orEmpty()
  val known = when {
    text.contains("Sign in", true) || BOT.containsMatchIn(text) -> Failure.VERIFICATION
    text.contains("private", true) || text.contains("unavailable", true) -> Failure.UNAVAILABLE
    OUTDATED.containsMatchIn(text) -> Failure.OUTDATED
    text.contains("network", true) || text.contains("resolve", true) -> Failure.NETWORK
    text.contains("403") -> Failure.REFUSED
    else -> null
  }
  return if (known != null) Failed(known)
  else Failed(Failure.FAILED, text.lineSequence().lastOrNull { it.isNotBlank() }?.take(240))
}

/** [error] as something to throw across to JavaScript. */
fun trouble(error: Throwable): YouTubeTrouble =
  failed(error).let { YouTubeTrouble(it.failure, it.detail, error) }
