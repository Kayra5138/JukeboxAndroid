package expo.modules.jukeboxaudio

import android.content.Context
import android.content.res.Configuration
import android.os.Handler
import android.os.Looper
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import java.util.Locale
import java.util.concurrent.CopyOnWriteArraySet

/**
 * The language the app is in, for everything that is drawn from Kotlin.
 *
 * The language is chosen by hand in Settings and is deliberately not the
 * phone's, so the system cannot be left to pick the words: a `getString` on an
 * ordinary context answers in whatever the phone is set to. Every string here
 * is read instead through a context that has been told the app's language
 * ([context]), and the choice is written down on this side because most of
 * what speaks from here does so with no JavaScript running — the widget, the
 * notifications, a car, a download finishing in the background.
 *
 * Android 13 has a per-app language of its own, and it is left alone. It
 * exists only from API 33, so the road above has to work without it anyway;
 * setting it restarts the activity under a running app, and it would put the
 * app in the system's language list, which promises a set of languages the
 * manifest would then have to declare. One mechanism that behaves the same on
 * every version is worth more than a second one on some of them.
 *
 * A language with no table here is not an error. Resources fall back to the
 * unmarked ones, which are the English, so a language JavaScript learns before
 * this side does is simply English in the notification until it is added.
 */
object Localised {
  /** A file of its own, as the car's sort order has: one small value that is read on its own. */
  private const val PREFERENCES = "jukebox_language"
  private const val TAG = "tag"

  /**
   * The application, kept from the first caller that had one.
   *
   * For the sentences that are made where no context is in reach: an
   * exception thrown from the middle of a parser is put into words when
   * somebody reads its message, not when it is thrown. [CoverProvider][expo.modules.jukeboxaudio.auto.CoverProvider]
   * hands it over as the process starts — a provider is created before
   * anything else in an app — so there is no moment at which it is missing.
   */
  @Volatile private var app: Context? = null

  @Volatile private var tag: String? = null

  /** The wrapped contexts, each kept with the tag it was made for. */
  @Volatile private var inLanguage: Pair<String, Context>? = null
  @Volatile private var inEnglish: Context? = null

  private val listeners = CopyOnWriteArraySet<() -> Unit>()
  private val main by lazy { Handler(Looper.getMainLooper()) }

  fun hold(context: Context) {
    if (app == null) app = context.applicationContext ?: context
  }

  /** The app's language as a BCP-47 tag: what was last set, or English. */
  fun tag(context: Context): String {
    tag?.let { return it }
    hold(context)
    val saved = runCatching {
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(TAG, null)
    }.getOrNull()
    return languageTag(saved).also { tag = it }
  }

  /**
   * Changes the language. True when it was not that already.
   *
   * Whoever is showing words is told on the main thread, after the change:
   * the service redraws its notification and tells a car to ask again, a
   * download in progress rewrites its line. Told nothing when nothing
   * changed, which is every start of the app but the first — JavaScript says
   * the language each time it opens.
   */
  fun set(context: Context, wanted: String): Boolean {
    val next = languageTag(wanted)
    if (next == tag(context)) return false
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(TAG, next).apply()
    tag = next
    main.post { listeners.forEach { runCatching(it) } }
    return true
  }

  /** [listener] is called on the main thread each time the language changes. */
  fun watch(listener: () -> Unit) { listeners.add(listener) }
  fun unwatch(listener: () -> Unit) { listeners.remove(listener) }

  /**
   * A context whose resources are in the app's language.
   *
   * For reading words and nothing else: it is the application's, not [base],
   * so it is no use for starting anything. Made once for each language and
   * kept, since making one builds a set of resources.
   */
  fun context(base: Context): Context {
    val wanted = tag(base)
    inLanguage?.takeIf { it.first == wanted }?.let { return it.second }
    return speaking(base, Locale.forLanguageTag(wanted)).also { inLanguage = wanted to it }
  }

  /**
   * The same in English whatever the app is in.
   *
   * For the few sentences JavaScript still recognises by their English
   * wording; see [expo.modules.jukeboxaudio.downloads.Failure].
   */
  fun english(base: Context): Context =
    inEnglish ?: speaking(base, Locale.ENGLISH).also { inEnglish = it }

  private fun speaking(base: Context, locale: Locale): Context {
    val root = base.applicationContext ?: base
    // setLocale and not adding to the list: with the phone's own languages
    // left behind it, Android would go on to them for anything it judged a
    // better match, which is the behaviour being replaced.
    val configuration = Configuration(root.resources.configuration).apply { setLocale(locale) }
    return root.createConfigurationContext(configuration)
  }

  fun text(context: Context, @StringRes id: Int, vararg with: Any?): String =
    filled(context(context), id, with)

  /** "3 tracks": the wording for [count], with the number already in it. */
  fun count(context: Context, @PluralsRes id: Int, count: Int): String =
    context(context).resources.getQuantityString(id, count, count)

  fun text(context: Context, words: Words): String = filled(context(context), words.id, words.with)

  /** [words] in the app's language, or null where there is no app to ask: a unit test. */
  fun said(words: Words): String? = app?.let { text(it, words) }

  /** [words] in English, or null as [said]. */
  fun saidInEnglish(words: Words): String? = app?.let { filled(english(it), words.id, words.with) }

  private fun filled(speaking: Context, id: Int, with: Array<out Any?>): String {
    if (with.isEmpty()) return speaking.getString(id)
    // A gap may be filled by words of its own: "the track number", say.
    val parts = with.map { if (it is Words) filled(speaking, it.id, it.with) else it }
    return speaking.getString(id, *parts.toTypedArray())
  }
}

/** What English is called, and what the app is in until it is told otherwise. */
internal const val DEFAULT_LANGUAGE = "en"

/**
 * The tag a language is kept and looked up by, from whatever was handed over.
 *
 * Anything that is not a language at all is the default, so a value written
 * by a build that knew more, or mangled on the way, cannot leave the app
 * speaking nothing. Apart from the object above because it needs no phone,
 * and so can be held to this in a unit test.
 */
internal fun languageTag(given: String?): String {
  val asked = given?.trim().orEmpty()
  if (asked.isEmpty()) return DEFAULT_LANGUAGE
  val locale = Locale.forLanguageTag(asked.replace('_', '-'))
  return if (locale.language.isNullOrEmpty()) DEFAULT_LANGUAGE else locale.toLanguageTag()
}

/**
 * A sentence that has not been put into a language yet: which one, and what
 * goes in its gaps.
 *
 * The parts of this module that can be tested on a desk are the parts that
 * touch no phone, and a string resource is the phone's. So they answer with
 * one of these, and the words are found at the edge, where there is a context
 * to find them with.
 */
class Words(@StringRes val id: Int, vararg val with: Any?)

/**
 * Something that went wrong, said to the user in the app's language.
 *
 * The message is worked out when it is asked for rather than when this is
 * thrown, which is what lets it be thrown from anywhere and still come out in
 * the language the app is in by the time it is shown. An IllegalStateException
 * because that is what these were before they were translated, and what the
 * callers that catch them expect.
 */
open class Told(val words: Words, cause: Throwable? = null) : IllegalStateException(null, cause) {
  constructor(@StringRes id: Int, vararg with: Any?) : this(Words(id, *with))

  override val message: String
    get() = Localised.said(words) ?: "words ${words.id}"
}
