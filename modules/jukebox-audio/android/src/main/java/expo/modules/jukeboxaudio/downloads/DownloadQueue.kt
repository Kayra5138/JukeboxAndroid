package expo.modules.jukeboxaudio.downloads

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** What the worker is to do now. See [DownloadQueue] for how it is decided. */
sealed class Next {
  /** Fetch this one. It has been marked as being prepared. */
  class Take(val job: JSONObject) : Next()
  /**
   * Nothing may start yet, and something will: ask again in [millis].
   *
   * [awake] is whether the wait is for something that needs the phone kept
   * awake to happen — a search JavaScript is making — as against time
   * passing, which passes as well with the phone asleep.
   */
  class Wait(val millis: Long, val awake: Boolean = true) : Next()
  /** Nothing to do, and nothing that waiting here would bring. */
  object Idle : Next()
}

/** What has to be told to stop, when a job is cancelled. */
enum class Stop { NOTHING, DOWNLOAD, SEARCH }

/**
 * What the queue cannot see for itself and is told each time it is asked.
 *
 * [handBusy] is a search somebody typed, in flight or waiting to be; a search
 * made for the queue is known by the id of the job it is for, which is what
 * [searching] is asked with. [finderWaiting] is JavaScript standing in
 * [DownloadStore.awaitFind] at this moment, asking for a name to look for.
 */
class Outside(
  val handBusy: Boolean = false,
  val finderWaiting: Boolean = false,
  val searching: (String) -> Boolean = { false },
  val wifi: () -> Boolean = { true }
)

/**
 * The one queue: every job there is, in order, and whose turn it is.
 *
 * Nothing here touches the phone. The file the jobs are kept in, the library
 * a finished one is looked for in and the network are [DownloadStore]'s, and
 * the time is handed in, so that the rules can be held to on a desk.
 *
 * WHO GOES FIRST. Both halves of the queue's work answer to this, and to
 * nothing else: [next], which the worker asks for a download, and
 * [claimFind], which JavaScript asks for a job whose video is still to be
 * looked for.
 *
 *  1. Paused, nothing new starts. What is under way finishes.
 *  2. One thing at a time. While a job is being fetched or being looked for,
 *     or a search made by hand is in flight or waiting, nothing starts.
 *  3. What a person asked for comes before what nobody did. An automatic job
 *     (Discover's own) is considered only when no other job is waiting, and
 *     no sooner than [COOL_DOWN_MS] after the last piece of work ended,
 *     whoever's it was. A worker that is already up sits that out rather
 *     than stop, since Android will not let it be started again from behind
 *     the screen; nothing is started for the sake of sitting it out.
 *  4. Within its kind, the order of the list. A job asked for by name is
 *     looked for when it is the first of its kind still waiting, and not
 *     before; a download behind it does not wait for that, because the
 *     looking is done by JavaScript and there may be no JavaScript running.
 *     The worker takes the first job that has a video.
 *  5. So that a run of downloads cannot starve a name ahead of them, the
 *     worker stands back for [FIND_WINDOW_MS] after each piece of work when
 *     the first job waiting is one to be looked for. A claim made in that
 *     window succeeds, and rule 2 then holds the worker until it is found.
 *  6. With only names waiting, the worker stays up while JavaScript is
 *     asking for one, or was within [FINDER_PATIENCE_MS] — it is not asking
 *     in the moment between being told of one search and asking for the
 *     next — so that an album of them is one run of the service and not one
 *     for each track. It gives up when nobody is, since nothing here can
 *     find them.
 *  7. A job that failed in a way trying again might cure is tried again
 *     once, by itself: see [again]. It goes to the end of its kind, and is
 *     passed over until [RETRY_DELAY_MS] after it failed — longer where
 *     YouTube said "not now" — while whatever is behind it goes ahead.
 *     Where nothing else is waiting, a worker that is up sits that out as it
 *     does rule 3's quiet, and none is started to.
 *  8. The background's one download, [takeById], is held to all of the
 *     above: it is handed its job only when that job is the one the worker
 *     would have been handed.
 *  9. A song somebody tapped in Discover goes to the very front of what is
 *     waiting: see [first]. It is the one thing that is put ahead of what
 *     was asked for before it, because the person is standing there waiting
 *     to hear it, and everything else in the queue was asked for by somebody
 *     who then went on to something else.
 * 10. A song may be looked for ahead of being wanted, and HELD: asked for
 *     with `hold`, it is found like any other name and then, instead of
 *     becoming a download, stays as it is with the status `found` until it
 *     is asked for again without `hold` — see [release]. Discover does this
 *     for the songs on its list that nobody has tapped yet, so that a tap
 *     has no search to wait for and a song with no recording is off the
 *     list before anybody tries it.
 *
 *     A held job is one of Discover's own and is behind everything a person
 *     asked for (rule 3). But it is a search and not a download — a few
 *     kilobytes, a few seconds — and is not made to sit out the long quiet
 *     that spaces Discover's downloads: it may be claimed [FIND_GAP_MS]
 *     after the last piece of work and after the last such search. Twenty
 *     songs at the long quiet would be a quarter of an hour of nothing
 *     happening; at this pace they are a search every eight seconds or so,
 *     which is slower than somebody typing them. Its ending does not count
 *     as work to wait after, either, or each one would put off Discover's
 *     next download by the long quiet again.
 *
 *     The first few go faster. A song of Discover's is shown only once its
 *     video is found, so the time these searches take is the time until
 *     there is a list to look at, and what matters most of that is the time
 *     until there is anything on the screen at all. So [FIND_BURST] of them
 *     in any minute may follow each other a second apart — five rows in a
 *     quarter of a minute — and the rest keep the longer gap. Five searches
 *     in fifteen seconds is what somebody typing quickly does; twenty would
 *     be a machine, and is what the longer gap is for. The minute slides,
 *     so the allowance comes back only when the searching has been slow or
 *     still for a while, and a long list never gets a second run of it.
 *
 *     Nothing is brought up or kept up for it. No worker, no notification,
 *     no wake lock: it is looked for while JavaScript happens to be there
 *     asking, and waits when it is not. When somebody taps a song, a held
 *     search that is under way for another song is put back at once
 *     ([giveWay]) so that the tap does not wait for it.
 *
 *     `found` is not waiting for anything and is not work: it does not
 *     count towards the queue's limit, is not touched by "cancel all" (those
 *     are downloads, and this is not one), is not cleared with what has
 *     finished, and is passed over by every rule above. It can be cancelled
 *     by name, and is forgotten with its song like any job of Discover's.
 */
class DownloadQueue(private val clock: () -> Long = System::currentTimeMillis) {
  companion object {
    val activeStates = setOf("queued", "finding", "preparing", "downloading", "converting", "saving", "cancelling")
    /** Being fetched: past waiting, and not yet at an end. */
    val fetching = setOf("preparing", "downloading", "converting", "saving", "cancelling")
    val finished = setOf("done", "failed", "cancelled", "missing")

    const val LIMIT = 500
    /** How long the worker stands back after a piece of work for a name ahead of it to be claimed. */
    const val FIND_WINDOW_MS = 2_000L
    /** How long after anything ended an automatic job may start. */
    const val COOL_DOWN_MS = 45_000L
    /** How long after any work, and after each other, the searches made ahead for held jobs are spaced. Rule 10. */
    const val FIND_GAP_MS = 5_000L
    /**
     * The first few of them after a quiet spell go closer together: rule 10.
     * [FIND_BURST] searches in any [FIND_BURST_WINDOW_MS] may follow each
     * other at [FIND_BURST_GAP_MS]; past that it is [FIND_GAP_MS] again.
     */
    const val FIND_BURST = 5
    const val FIND_BURST_GAP_MS = 1_000L
    const val FIND_BURST_WINDOW_MS = 60_000L
    /** How long since JavaScript last asked for a name before it is taken not to be there. */
    const val FINDER_PATIENCE_MS = 10_000L
    /** How long a job may be marked as being looked for with no search to show for it. */
    const val FIND_LEASE_MS = 30_000L
    /** How long after it failed a job is left before its second try. */
    const val RETRY_DELAY_MS = 20_000L
    /** The same where YouTube refused it, which a short wait does not get past. */
    const val RETRY_THROTTLED_MS = 120_000L
    /** How often the worker asks again while it is held. */
    const val POLL_MS = 250L
  }

  val jobs = mutableListOf<JSONObject>()
  var paused = false
    private set
  /** When the last piece of work ended: a download, or a search of any kind. */
  var lastEnded = 0L
    private set
  /** When JavaScript last asked for a job to look for. Not kept: a new process has asked for nothing. */
  var finderSeen = 0L
    private set
  /** When a search for a held job last ended. Not kept: a new process starts with one search early, which costs nothing. */
  var lastSought = 0L
    private set
  /** When each of the last few ended, for the allowance of [FIND_BURST]. Not kept either. */
  private val soughtLately = ArrayDeque<Long>()

  /** A search for a held job has ended, however it ended. */
  private fun sought() {
    lastSought = clock()
    soughtLately.addLast(lastSought)
    while (soughtLately.size > FIND_BURST) soughtLately.removeFirst()
  }

  /** How long the next search made ahead has to leave after the last, and after any other work: rule 10. */
  private fun findGap(): Long {
    val now = clock()
    // Only the ones within the last minute count, and none from a clock that has since been put back.
    val lately = soughtLately.count { it <= now && now - it < FIND_BURST_WINDOW_MS }
    return if (lately < FIND_BURST) FIND_BURST_GAP_MS else FIND_GAP_MS
  }

  /** Set by anything that changed a job in a way worth keeping, and cleared by whoever writes them down. */
  var changed = false
  /** The same, for [paused] and [lastEnded]. */
  var stateChanged = false

  /** The jobs as they are written down, and read back: a list, in the order they are worked through. */
  fun written(): String = JSONArray(jobs).toString()
  fun read(text: String) {
    val array = JSONArray(text)
    for (index in 0 until array.length()) jobs.add(array.getJSONObject(index))
  }

  /** What is kept beside the jobs: whether the queue is paused, and when it last worked. */
  fun stateWritten(): String = JSONObject().put("paused", paused).put("lastEnded", lastEnded).toString()
  fun readState(text: String) {
    val kept = JSONObject(text)
    paused = kept.optBoolean("paused")
    lastEnded = kept.optLong("lastEnded")
  }

  /** Since [then], and a long time where the clock has been put back past it. */
  private fun since(then: Long): Long = (clock() - then).let { if (it < 0) Long.MAX_VALUE else it }

  private fun find(id: String) = jobs.firstOrNull { it.optString("id") == id }
  private fun copy(job: JSONObject) = JSONObject(job.toString())

  private fun ended() { lastEnded = clock(); stateChanged = true }

  /** A search made by hand has ended. It counts towards rule 3 and is not worth a write. */
  fun touch() { lastEnded = clock() }

  private fun fail(job: JSONObject, failed: Failed?) {
    job.put("error", failed?.english ?: JSONObject.NULL)
      .put("errorCode", failed?.failure?.code ?: JSONObject.NULL)
  }

  /** Brings [job] to an end. [worked] is whether YouTube was asked anything on its way there. */
  private fun end(job: JSONObject, status: String, failed: Failed? = null, worked: Boolean = true) {
    job.put("status", status).put("finishedAt", clock())
    job.remove("retryAt")
    fail(job, failed)
    if (worked) ended()
    changed = true
  }

  /**
   * [job] failed while it was being fetched or looked for: it is given its
   * one second try, or brought to an end. Rule 7 of WHO GOES FIRST.
   *
   * That it has had the try is written on the job (`retried`), with why the
   * first one failed, so that a list can say what it is waiting for; and
   * stays on it through the app being closed, so that the second failure is
   * the last however it comes about. [wait] is false where the fault was the
   * process dying, which is over by the time anybody reads this.
   */
  private fun again(job: JSONObject, failed: Failed, worked: Boolean = true, wait: Boolean = true) {
    val how = failed.again
    @Suppress("NAME_SHADOWING") val worked = worked && !job.hold
    if (how == Again.NEVER || job.optBoolean("retried")) return end(job, "failed", failed, worked)
    val delay = if (!wait) 0 else if (how == Again.LATER) RETRY_THROTTLED_MS else RETRY_DELAY_MS
    job.put("retried", true).put("retryAt", clock() + delay)
      .put("retryError", failed.english).put("retryErrorCode", failed.failure.code)
      .put("status", "queued").put("progress", 0).put("trackId", JSONObject.NULL)
    job.remove("touched")
    fail(job, null)
    // Not back where it was: whatever stopped it may still be there, and the others should not wait to find out.
    jobs.remove(job)
    place(job)
    /*
      Unless somebody tapped it and is waiting to hear it (rule 9). That one
      is still first when its wait is over: the others go by it while it
      waits, since a job held back is passed over, and none of them is put
      ahead of it for good. Behind everything else that was ever asked for —
      an album of forty tracks, say — is not where a tap belongs because the
      connection dropped once.
    */
    if (job.optBoolean("fronted")) ahead(job)
    if (worked) ended()
    changed = true
  }

  /** How long until [job] may be tried again; nought for one that is not waiting to be, or whose time has come. */
  private fun held(job: JSONObject): Long =
    // Never longer than the longest wait there is: a clock that was put back does not strand it.
    (job.optLong("retryAt") - clock()).coerceIn(0, RETRY_THROTTLED_MS)

  /** Rule 7: the jobs of [line] whose time has come, or how long until the first of them does. */
  private fun due(line: List<JSONObject>): Turn {
    val ready = line.filter { held(it) == 0L }
    return if (ready.isNotEmpty()) Turn.Of(ready) else Turn.Cooling(line.minOf(::held))
  }

  /**
   * What a process that died left half done.
   *
   * A download that was under way was interrupted, which is a failure like
   * any other that trying again may cure: it has its one second try, in its
   * turn, and where it has had that already it failed and says so. Nothing
   * is started from here either way. What was only waiting still is — the queue
   * outlives the app — and a job that was being looked for goes back to
   * waiting, since nothing of it was fetched. [published] answers whether a
   * file that was being added to the library when the process died got there.
   */
  fun recover(published: (JSONObject) -> Boolean) {
    val interrupted = mutableListOf<JSONObject>()
    for (job in jobs) when (job.status) {
      "saving" -> if (published(job)) { job.put("progress", 100); end(job, "done", worked = false) }
        else interrupted += job
      "preparing", "downloading", "converting" -> interrupted += job
      "cancelling" -> end(job, "cancelled", worked = false)
      "finding" -> { job.put("status", "queued"); changed = true }
    }
    // After the pass, since a second try moves the job in the list being gone through.
    interrupted.forEach { again(it, Failed(Failure.INTERRUPTED), worked = false, wait = false) }
    jobs.filter { it.status == "queued" && it.automatic }.forEach(::rejoin)
  }

  /**
   * The service was stopped under what it was doing. What was being fetched
   * failed, and says how, or has its second try; what was only waiting still is, and a job that was
   * being looked for waits again.
   */
  fun interrupt(failure: Failure) {
    for (job in jobs.toList()) when (job.status) {
      in fetching -> again(job, Failed(failure))
      "finding" -> { job.put("status", "queued"); rejoin(job); changed = true }
    }
  }

  /** Where a new or returning job goes: the end of its kind, which for a person's is ahead of every automatic one. */
  private fun place(job: JSONObject) {
    val at = if (job.automatic) -1 else jobs.indexOfFirst { it.status == "queued" && it.automatic }
    if (at < 0) jobs.add(job) else jobs.add(at, job)
  }

  /**
   * A job has gone back to waiting where it stood. While it was being
   * looked for it was not waiting, and somebody's job may have been put
   * after it meanwhile: one of Discover's own steps back behind those, so
   * that the list is still what was asked for and then what was not.
   */
  private fun rejoin(job: JSONObject) {
    if (!job.automatic) return
    val last = jobs.indexOfLast { it.status == "queued" && !it.automatic }
    if (last > jobs.indexOf(job)) { jobs.remove(job); jobs.add(last, job) }
  }

  private fun add(video: JSONObject, format: String, folder: String, discoverKey: String?): String {
    if (jobs.count { it.status in activeStates } >= LIMIT) throw YouTubeTrouble(Failure.QUEUE_FULL)
    val id = UUID.randomUUID().toString()
    val job = JSONObject().put("id", id).put("video", video).put("format", format)
      .put("discoverKey", discoverKey ?: JSONObject.NULL).put("folder", folder).put("status", "queued").put("progress", 0)
      .put("trackId", JSONObject.NULL).put("error", JSONObject.NULL).put("described", false)
      .put("createdAt", clock()).put("startedAt", JSONObject.NULL).put("finishedAt", JSONObject.NULL)
      // Only Discover fetches what nobody asked for, and it says so on the video.
      .put("automatic", discoverKey != null && video.optBoolean("discoverAutomatic")).put("cleared", false)
    place(job)
    changed = true
    return id
  }

  private fun checked(format: String, folder: String, discoverKey: String?): String {
    require(format in setOf("mp3", "original"))
    if (discoverKey != null) require(discoverKey.matches(Regex("[a-fA-F0-9-]{36}")))
    return YouTubeData.folder(folder)
  }

  /** A video to fetch. One that is here already in that format, or on its way, is answered with the job it has. */
  fun enqueue(video: JSONObject, format: String, folder: String, discoverKey: String? = null,
    exists: (JSONObject) -> Boolean): String {
    val id = video.getString("id")
    YouTubeData.url(id)
    val destination = checked(format, folder, discoverKey)
    video.remove("find")
    // The same file: the same video, saved as the same thing. One that is
    // being cancelled is on its way out, and asking again is asking anew.
    val existing = jobs.lastOrNull { !it.toFind && it.video.optString("id") == id &&
      it.text("discoverKey") == discoverKey && it.optString("format") == format &&
      (it.status in activeStates || it.status == "done") && it.status != "cancelling" }
    if (existing != null) {
      if (existing.status != "done" || exists(existing)) return existing.getString("id")
      existing.put("status", "missing").put("trackId", JSONObject.NULL)
      changed = true
    }
    return add(video, format, destination, discoverKey)
  }

  /** All of [videos] or none of them: a list that does not fit leaves the queue as it was. */
  fun enqueueBatch(videos: List<JSONObject>, format: String, folder: String, exists: (JSONObject) -> Boolean): List<String> {
    if (videos.size !in 1..LIMIT) throw YouTubeTrouble(Failure.BATCH)
    val before = jobs.map(::copy)
    try {
      return videos.distinctBy { it.getString("id") }.map { enqueue(it, format, folder, null, exists) }
    } catch (error: Exception) {
      jobs.clear(); jobs.addAll(before)
      throw error
    }
  }

  /**
   * A song to fetch, by name: a job like any other, in its place in the
   * list, with what to look for in `video.find` and no video yet.
   *
   * Asked for twice, it is one job. Discover's is known by its key, which is
   * the recording; anybody else's by what it looks for and the place on a
   * record it is for.
   */
  fun enqueueFind(video: JSONObject, format: String, folder: String, discoverKey: String?,
    exists: (JSONObject) -> Boolean, front: Boolean = false, hold: Boolean = false): String {
    val destination = checked(format, folder, discoverKey)
    val query = video.optJSONObject("find")?.optString("query")?.trim().orEmpty()
    if (query.length !in 1..500) throw YouTubeTrouble(Failure.QUERY)
    video.put("id", "").put("url", "")
    val waiting = { job: JSONObject -> job.status in activeStates && job.status != "cancelling" }
    val existing = if (discoverKey != null) jobs.lastOrNull { it.text("discoverKey") == discoverKey && (waiting(it) || it.status == "done" || it.status == "found") }
      else jobs.lastOrNull { it.isNull("discoverKey") && waiting(it) && it.toFind &&
        it.video.getJSONObject("find").optString("query").trim() == query && placed(it.video) == placed(video) }
    if (existing != null) {
      if (existing.status != "done" || exists(existing)) {
        // Wanted now, by whoever is asking without `hold`: a held job is let go. Asked to be held again, it already is.
        if (!hold && existing.hold) release(existing, video)
        if (front) first(existing)
        return existing.getString("id")
      }
      existing.put("status", "missing").put("trackId", JSONObject.NULL)
      changed = true
    }
    /*
      Tapped again after its download failed: the video was found the first
      time and is still the one, so the job that has it is put back rather
      than a new one made to be searched for all over again.
    */
    if (front && discoverKey != null) {
      val stopped = jobs.lastOrNull { it.text("discoverKey") == discoverKey && it.status in setOf("failed", "cancelled") && !it.toFind }
      if (stopped != null && retry(stopped.getString("id"))) {
        first(stopped)
        return stopped.getString("id")
      }
    }
    finderSeen = clock()
    val id = add(video, format, destination, discoverKey)
    val job = jobs.first { it.optString("id") == id }
    // Only Discover holds, and never what somebody is waiting for.
    if (hold && !front && discoverKey != null) job.put("hold", true)
    if (front) first(job)
    return id
  }

  /**
   * Puts [job] ahead of everything that is waiting. Rule 9 of WHO GOES FIRST.
   *
   * It becomes a person's job on the way — it may use whatever connection
   * there is, and does not sit out the quiet Discover's own wait for — and
   * one that was waiting for its second try has it now: whoever tapped it is
   * not going to stand there for the two minutes it was put off by. A job
   * that is already being looked for or fetched is left where it is, since
   * it is first already.
   */
  private fun first(job: JSONObject) {
    asked(job)
    job.remove("retryAt")
    // Remembered, for the second try the queue gives it by itself: see [again].
    job.put("fronted", true)
    if (job.status == "queued") ahead(job)
    changed = true
  }

  /**
   * Lets a held job go: from here on it is a download like any other of its
   * kind. Rule 10 of WHO GOES FIRST.
   *
   * One whose video is already known goes into the queue at the end of its
   * kind, with nothing to look for; one still to be looked for only stops
   * being held, and becomes a download when it is found. Whether it is
   * Discover's own, and whether it may use mobile data, is what [request]
   * says and not what was said when it was held: the looking was allowed on
   * any connection, and the fetching may not be.
   */
  private fun release(job: JSONObject, request: JSONObject?) {
    job.remove("hold")
    if (request != null) {
      for (name in listOf("discoverAutomatic", "discoverWifiOnly")) job.video.put(name, request.optBoolean(name))
      job.put("automatic", request.optBoolean("discoverAutomatic"))
    }
    if (job.status == "found") {
      job.put("status", "queued").put("progress", 0)
      jobs.remove(job)
      place(job)
    }
    changed = true
  }

  /**
   * Puts back every search under way for a held job, and answers which they
   * were, for whoever has to stop them. For when somebody has just tapped a
   * song: the queue does one thing at a time, and a search made on the
   * chance of a tap must not be the thing a tap waits for.
   */
  fun giveWay(): List<String> {
    val under = jobs.filter { it.status == "finding" && it.hold }
    for (job in under) { job.put("status", "queued"); job.remove("touched"); changed = true }
    // Not to be taken up again the moment it is put down: the search it had is still being stopped.
    if (under.isNotEmpty()) lastSought = clock()
    return under.map { it.getString("id") }
  }

  /** Moves a waiting job ahead of every other waiting job. */
  private fun ahead(job: JSONObject) {
    jobs.remove(job)
    val at = jobs.indexOfFirst { it.status == "queued" }
    if (at < 0) jobs.add(job) else jobs.add(at, job)
  }

  /** The place on a record a video was asked for, as a word, or null. Numbers come back from JavaScript as 7.0 and from the file as 7. */
  private fun placed(video: JSONObject): String? = video.optJSONObject("placement")
    ?.let { "${it.text("album")}|${it.optDouble("disc")}|${it.optDouble("track")}" }

  private sealed class Turn {
    /** Rule 2: something is under way. */
    object Held : Turn()
    /** Nothing may start, and nothing will by waiting. */
    object Rest : Turn()
    /** Rules 3 and 7: nothing may start for this long, and then something may. */
    class Cooling(val millis: Long) : Turn()
    /** The jobs of the kind whose turn it is, in order. Never empty. */
    class Of(val jobs: List<JSONObject>) : Turn()
  }

  /** Rules 1 to 3 of WHO GOES FIRST, for [next], [claimFind] and [takeById] alike. */
  private fun turn(outside: Outside): Turn {
    // JavaScript took one to look for and went away: reloaded, or out of time.
    for (job in jobs.toList()) {
      if (job.status == "finding" && !outside.searching(job.getString("id")) && since(job.optLong("touched")) >= FIND_LEASE_MS) {
        job.put("status", "queued"); rejoin(job); changed = true
      }
    }
    if (paused) return Turn.Rest
    if (outside.handBusy || jobs.any { it.status in fetching || it.status == "finding" }) return Turn.Held
    val waiting = jobs.filter { it.status == "queued" }
    val asked = waiting.filter { !it.automatic }
    if (asked.isNotEmpty()) return due(asked)
    if (waiting.isEmpty()) return Turn.Rest
    val quiet = since(lastEnded)
    if (quiet >= COOL_DOWN_MS) return due(waiting)
    // Rule 10: the searches made ahead do not sit out the long quiet, only a short one.
    val ahead = waiting.filter { it.hold && it.toFind }
    if (ahead.isEmpty()) return Turn.Cooling(COOL_DOWN_MS - quiet)
    val gap = findGap()
    return if (quiet < gap) Turn.Cooling(gap - quiet) else due(ahead)
  }

  /** Whether [line] has a name in it that a worker should stay up for: one that will become a download. A held one will not. */
  private fun namesToFetch(line: List<JSONObject>) = line.any { it.toFind && !it.hold }

  /** Notes when work on [job] first began: looking for it, or fetching it. */
  private fun begun(job: JSONObject) { if (job.isNull("startedAt")) job.put("startedAt", clock()) }

  /** Discover's own may be told to keep off mobile data. Said when its turn comes, as it always was, and not before. */
  private fun barred(job: JSONObject, outside: Outside): Boolean {
    if (!job.video.optBoolean("discoverWifiOnly") || outside.wifi()) return false
    end(job, "failed", Failed(Failure.WAITING_WIFI), worked = false)
    return true
  }

  private fun finderThere(outside: Outside) = outside.finderWaiting || since(finderSeen) < FINDER_PATIENCE_MS

  /** The worker's question. Rules 3 to 6 of WHO GOES FIRST. */
  fun next(outside: Outside): Next {
    while (true) {
      val line = when (val turn = turn(outside)) {
        is Turn.Held -> return Next.Wait(POLL_MS)
        is Turn.Rest -> return Next.Idle
        is Turn.Cooling -> return Next.Wait(turn.millis, awake = false)
        is Turn.Of -> turn.jobs
      }
      val ready = line.firstOrNull { !it.toFind }
        ?: return if (namesToFetch(line) && finderThere(outside)) Next.Wait(POLL_MS) else Next.Idle
      val quiet = since(lastEnded)
      if (line.first().toFind && quiet < FIND_WINDOW_MS) return Next.Wait(FIND_WINDOW_MS - quiet)
      if (barred(ready, outside)) continue
      begun(ready)
      ready.put("status", "preparing")
      changed = true
      return Next.Take(copy(ready))
    }
  }

  /**
   * Whether a worker would have anything to do, were one started. Starts
   * nothing. Not for the quiet Discover's own wait out: a worker that is up
   * sits through that, and none is brought up to.
   */
  fun wants(outside: Outside): Boolean = when (val turn = turn(outside)) {
    // Held by a search made ahead and by nothing else, there is nothing a worker would be up for: rule 10.
    is Turn.Held -> outside.handBusy || jobs.any { it.status in fetching || (it.status == "finding" && !it.hold) }
    is Turn.Rest, is Turn.Cooling -> false
    is Turn.Of -> turn.jobs.any { !it.toFind } || (namesToFetch(turn.jobs) && finderThere(outside))
  }

  /** Whether any job is waiting for its video to be looked for: what a finder has to stay for. */
  fun namesWaiting(): Boolean = jobs.any { it.status == "queued" && it.toFind }

  /**
   * JavaScript's question: the job whose video it may look for now, marked
   * as being looked for, or null where it is not a search's turn.
   *
   * Asking is also how the worker knows there is somebody to do the looking
   * (rule 6), so it counts whatever the answer.
   */
  fun claimFind(outside: Outside): JSONObject? {
    finderSeen = clock()
    while (true) {
      val first = (turn(outside) as? Turn.Of)?.jobs?.first() ?: return null
      if (!first.toFind) return null
      // Rule 10: searches made ahead keep a little apart from each other.
      if (first.hold && since(lastSought) < findGap()) return null
      if (barred(first, outside)) continue
      begun(first)
      first.put("status", "finding").put("touched", clock())
      changed = true
      return copy(first)
    }
  }

  fun isFinding(id: String): Boolean = find(id)?.status == "finding"

  /** The song being looked for, for the notification to name. */
  fun findingTitle(): String? = jobs.firstOrNull { it.status == "finding" }?.video?.optString("title")

  /** A search for [id] came back. The choosing is quick, and is given the same grace again to be told. */
  fun searched(id: String) {
    find(id)?.takeIf { it.status == "finding" }?.put("touched", clock())
    finderSeen = clock()
  }

  /** The search for [id] was put off for one made by hand. It waits its turn again, where it was. */
  fun requeueFind(id: String) {
    val job = find(id)?.takeIf { it.status == "finding" } ?: return
    job.put("status", "queued")
    rejoin(job)
    finderSeen = clock()
    if (job.hold) sought() else ended()
    changed = true
  }

  /** The search for [id] did not go through. */
  fun failFind(id: String, failed: Failed) {
    val job = find(id)?.takeIf { it.status == "finding" } ?: return
    finderSeen = clock()
    if (job.hold) sought()
    again(job, failed)
  }

  /**
   * What looking for [id] came to.
   *
   * With a video the job becomes an ordinary download in the place it
   * already had, keeping whatever whoever asked for it attached: what to tag
   * the file as, the record it completes. With none it has failed, for want
   * of a recording that fits.
   *
   * A video the queue already has is not fetched a second time. Discover's
   * job is dropped, and Discover finds the other by its key as it does after
   * the app has been closed. Anybody else's hands what it carried to the job
   * that is there — which is then filed under the record this one was asked
   * for — unless that job is for another record, or is being saved as
   * something else, in which case the two are different files and both are
   * fetched.
   */
  fun resolveFind(id: String, found: JSONObject?, exists: (JSONObject) -> Boolean) {
    val job = find(id)?.takeIf { it.status == "finding" } ?: return
    finderSeen = clock()
    val held = job.hold
    if (held) sought()
    // A search made ahead is not work to wait after: rule 10.
    if (found == null) return end(job, "failed", Failed(Failure.NO_MATCH), worked = !held)
    val videoId = found.optString("id")
    val url = try { YouTubeData.url(videoId) } catch (error: YouTubeTrouble) {
      end(job, "failed", Failed(error.failure))
      throw error
    }
    val key = job.text("discoverKey")
    val video = job.video
    val twin = jobs.lastOrNull { it !== job && !it.toFind && it.video.optString("id") == videoId &&
      it.text("discoverKey") == key && it.optString("format") == job.optString("format") &&
      ((it.status in activeStates && it.status != "cancelling") || it.status == "done") }
    if (twin != null) {
      val theirs = placed(twin.video)
      if (twin.status == "done" && !exists(twin)) twin.put("status", "missing").put("trackId", JSONObject.NULL)
      else if (key != null) { jobs.remove(job); ended(); changed = true; return }
      else if (theirs == null || theirs == placed(video)) {
        for (name in listOf("placement", "discoveryTitle", "discoveryArtist")) {
          if (video.has(name) && !twin.video.has(name)) twin.video.put(name, video.get(name))
        }
        // Filed under the record by whoever reads a finished job that has not been gone through.
        if (twin.status == "done" && theirs == null && placed(video) != null) twin.put("described", false)
        twin.put("cleared", false)
        jobs.remove(job); ended(); changed = true
        return
      }
    }
    video.remove("find")
    video.put("id", videoId).put("url", url)
      .put("title", found.text("title")?.takeIf { it.isNotBlank() } ?: video.optString("title"))
      .put("channel", found.text("channel") ?: video.optString("channel"))
      .put("thumbnail", found.text("thumbnail")?.takeIf { it.startsWith("https://") } ?: JSONObject.NULL)
      .put("duration", found.optDouble("duration").takeIf { it.isFinite() && it > 0 } ?: JSONObject.NULL)
    // Held, it stays as it is, with its video known, until it is asked for: rule 10.
    job.put("status", if (held) "found" else "queued").put("progress", 0)
    job.remove("touched")
    if (!held) rejoin(job)
    changed = true
  }

  /**
   * The background's way in: this job of Discover's and no other, and only
   * when it is the one whose turn it is. Rule 8 of WHO GOES FIRST.
   */
  fun takeById(id: String, outside: Outside): JSONObject? {
    val job = find(id)?.takeIf { it.status == "queued" && !it.toFind && !it.isNull("discoverKey") } ?: return null
    val line = (turn(outside) as? Turn.Of)?.jobs ?: return null
    if (line.firstOrNull { !it.toFind } !== job || barred(job, outside)) return null
    begun(job)
    job.put("status", "preparing")
    changed = true
    return copy(job)
  }

  /** Somebody asked for this one themselves: it is no longer Discover's own, and may use the connection there is. */
  private fun asked(job: JSONObject) {
    job.put("automatic", false)
    val video = job.video
    if (video.has("discoverAutomatic")) video.put("discoverAutomatic", false)
    if (video.has("discoverWifiOnly")) video.put("discoverWifiOnly", false)
  }

  fun prioritizeDiscovery(id: String) {
    val job = jobs.firstOrNull { it.optString("id") == id && !it.isNull("discoverKey") } ?: return
    // An explicit play request is allowed to use the current connection.
    job.video.put("discoverWifiOnly", false).put("discoverAutomatic", false)
    if (job.hold) release(job, null)
    first(job)
  }

  /**
   * Moves a waiting job to just before another waiting job, or for null to
   * the end of what people have asked for.
   *
   * The list stays in two parts, what was asked for and then what was not.
   * So an automatic job put ahead of one somebody asked for has been asked
   * for too, and one somebody asked for cannot be put behind an automatic
   * one: it goes to the end of its own part.
   */
  fun move(id: String, beforeId: String?): Boolean {
    val job = find(id)?.takeIf { it.status == "queued" } ?: return false
    if (beforeId == id) return false
    val before = if (beforeId == null) null else find(beforeId)?.takeIf { it.status == "queued" } ?: return false
    jobs.remove(job)
    // The end is the end of what people asked for: Discover's own are always last.
    val to = if (before != null) jobs.indexOf(before) else jobs.indexOfFirst { it.status == "queued" && it.automatic }
    if (to < 0) jobs.add(job) else jobs.add(to, job)
    val at = jobs.indexOf(job)
    if (job.automatic) {
      if (jobs.drop(at + 1).any { it.status == "queued" && !it.automatic }) asked(job)
    } else {
      val automatic = jobs.indexOfFirst { it.status == "queued" && it.automatic }
      if (automatic in 0 until at) { jobs.remove(job); jobs.add(automatic, job) }
    }
    changed = true
    return true
  }

  /**
   * Puts a job that failed, was cancelled or lost its file back in the
   * queue, at the end of what people have asked for: pressing retry is
   * asking. One that failed while it was being looked for still carries what
   * to look for, and is looked for again.
   */
  fun retry(id: String): Boolean {
    val job = find(id)?.takeIf { it.status in setOf("failed", "cancelled", "missing") } ?: return false
    val videoId = job.video.optString("id")
    if (!job.toFind && jobs.any { it !== job && it.status in activeStates && it.status != "cancelling" &&
        it.video.optString("id") == videoId && it.optString("format") == job.optString("format") &&
        it.text("discoverKey") == job.text("discoverKey") }) return false
    if (jobs.count { it.status in activeStates } >= LIMIT) throw YouTubeTrouble(Failure.QUEUE_FULL)
    asked(job)
    job.put("status", "queued").put("progress", 0).put("trackId", JSONObject.NULL)
      .put("finishedAt", JSONObject.NULL).put("startedAt", JSONObject.NULL).put("cleared", false)
    // Asked for afresh, with a second try of its own to come.
    for (name in listOf("retried", "retryAt", "retryError", "retryErrorCode")) job.remove(name)
    fail(job, null)
    jobs.remove(job)
    place(job)
    changed = true
    return true
  }

  fun setPaused(value: Boolean) {
    if (paused == value) return
    paused = value
    stateChanged = true
  }

  /**
   * Clears what has finished from the list of what was fetched.
   *
   * Marked and not removed. A finished job is how a video is known to be
   * here already, how a playlist learns which of its tracks arrived, and
   * what Discover's list points at for a song's file or for why it has none.
   */
  fun clearFinished() {
    for (job in jobs) {
      if (job.status in finished && !job.optBoolean("cleared")) { job.put("cleared", true); changed = true }
    }
  }

  fun change(id: String, status: String, progress: Int = 0, error: Failed? = null, trackId: String? = null) {
    val job = find(id) ?: return
    val old = job.status
    if (old == "cancelling" && status in setOf("downloading", "converting", "preparing")) return
    // Failed while it was being fetched, and not because somebody was stopping it.
    if (status == "failed" && error != null && old in fetching && old != "cancelling") return again(job, error)
    job.put("status", status).put("progress", progress)
    fail(job, error)
    if (trackId != null) job.put("trackId", trackId)
    if (old != status && status in finished) {
      job.put("finishedAt", clock())
      job.remove("retryAt")
      if (old in fetching) ended()
    }
    // Progress is transient. State transitions and receipts are durable.
    if (old != status || trackId != null) changed = true
  }

  fun complete(id: String, trackId: String) {
    val job = jobs.first { it.getString("id") == id }
    job.put("trackId", trackId).put("progress", 100)
    end(job, "done")
  }

  /** Cancels one job, and answers what has to be stopped for it to be so. */
  fun cancel(id: String): Stop {
    val job = find(id) ?: return Stop.NOTHING
    return when (job.status) {
      "queued", "found" -> { end(job, "cancelled", worked = false); Stop.NOTHING }
      "finding" -> { end(job, "cancelled", worked = !job.hold); Stop.SEARCH }
      "preparing", "downloading", "converting" -> { change(id, "cancelling"); Stop.DOWNLOAD }
      else -> Stop.NOTHING // Publication is a short, non-cancellable commit.
    }
  }

  /**
   * Cancels everything that is waiting or under way, and answers what has to
   * be stopped. Not what is held or being looked for ahead (rule 10): those
   * are not downloads, nobody who pressed this was shown them, and stopping
   * them would only have them looked for again.
   */
  fun cancelAll(): List<Pair<String, Stop>> =
    jobs.filter { it.status in activeStates && !it.hold }.map { it.getString("id") }.map { it to cancel(it) }

  fun isCancelling(id: String): Boolean = find(id)?.status == "cancelling"

  /** Fails those of [ids] that are waiting or under way: the service could not be started for them. */
  fun failActive(ids: Collection<String>, failure: Failure) {
    for (job in jobs) {
      if (job.status in activeStates && job.optString("id") in ids) {
        end(job, "failed", Failed(failure), worked = false)
      }
    }
  }
}

/** A field that may be null, as null. `optString` answers "null" for one on the phone and "" on a desk. */
internal fun JSONObject.text(key: String): String? = if (isNull(key)) null else optString(key)
internal val JSONObject.status: String get() = optString("status")
internal val JSONObject.video: JSONObject get() = getJSONObject("video")
/** Asked for by name, and not yet found. */
internal val JSONObject.toFind: Boolean get() = video.optJSONObject("find") != null
internal val JSONObject.automatic: Boolean get() = optBoolean("automatic")
/** Looked for ahead of being wanted, and to be held when found: rule 10 of WHO GOES FIRST. */
internal val JSONObject.hold: Boolean get() = optBoolean("hold")
