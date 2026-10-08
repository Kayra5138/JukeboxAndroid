package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/*
  Whose turn it is, held to on a desk: the queue with a clock that is moved
  by hand and a world that is whatever each question says it is. The file it
  is kept in and the service that works through it are the phone's.
*/
class DownloadQueueTest {
  private var now = 1_000_000_000L
  private val queue = DownloadQueue { now }
  private val here: (JSONObject) -> Boolean = { true }
  private val quiet = Outside()

  private val recording = "11111111-2222-3333-4444-555555555555"
  private val another = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

  private fun videoId(n: Int) = "video%06d".format(n)
  private fun video(n: Int) = JSONObject().put("id", videoId(n)).put("url", "").put("title", "Video $n")
    .put("channel", "Channel").put("thumbnail", JSONObject.NULL).put("duration", 162)
  private fun named(title: String) = JSONObject().put("id", "").put("url", "").put("title", title)
    .put("channel", "Linkin Park").put("thumbnail", JSONObject.NULL).put("duration", JSONObject.NULL)
    .put("find", JSONObject().put("query", "Linkin Park $title official audio").put("artist", "Linkin Park")
      .put("title", title).put("durationSec", 162))
  private fun place(track: Int, album: String = "Meteora") = JSONObject().put("album", album).put("title", "Track $track")
    .put("artist", "Linkin Park").put("track", track).put("disc", JSONObject.NULL)

  private fun download(n: Int) = queue.enqueue(video(n), "mp3", "Music", null, here)
  private fun name(title: String) = queue.enqueueFind(named(title), "mp3", "Music", null, here)
  /** One of Discover's own, by name or with its video. */
  private fun own(n: Int, key: String = recording, wifiOnly: Boolean = false) = queue.enqueue(
    video(n).put("discoverAutomatic", true).put("discoverWifiOnly", wifiOnly), "mp3", "Music", key, here)
  private fun ownNamed(title: String, key: String = recording) =
    queue.enqueueFind(named(title).put("discoverAutomatic", true).put("discoverWifiOnly", false), "mp3", "Music", key, here)

  private fun job(id: String) = queue.jobs.first { it.getString("id") == id }
  private fun status(id: String) = job(id).getString("status")
  private fun order() = queue.jobs.filter { it.getString("status") == "queued" }.map { it.getString("id") }
  private fun taken() = (queue.next(quiet) as Next.Take).job.getString("id")
  private fun claimed() = queue.claimFind(quiet)?.getString("id")
  /** The finder is taken to be gone, and nothing to have ended lately. */
  private fun muchLater() { now += 10 * 60_000 }

  @Test fun aJobSaysWhenItWasAskedForAndWhenItEnded() {
    val id = download(1)
    assertEquals(now, job(id).getLong("createdAt"))
    assertTrue(job(id).isNull("finishedAt"))
    assertFalse(job(id).getBoolean("automatic"))
    assertTrue(job(id).isNull("startedAt"))
    now += 5_000
    assertEquals(id, taken())
    assertEquals(now, job(id).getLong("startedAt"))
    now += 30_000
    queue.complete(id, "42")
    assertEquals(now, job(id).getLong("finishedAt"))
    assertEquals(now, queue.lastEnded)
    assertTrue(queue.stateChanged)
  }

  @Test fun oneAtATimeInTheOrderOfTheList() {
    val first = download(1); val second = download(2)
    assertEquals(first, taken())
    assertTrue(queue.next(quiet) is Next.Wait)
    queue.change(first, "downloading", 40)
    assertTrue(queue.next(quiet) is Next.Wait)
    queue.complete(first, "1")
    assertEquals(second, taken())
    queue.change(second, "failed", error = Failed(Failure.NETWORK))
    assertTrue(queue.next(quiet) is Next.Idle)
  }

  @Test fun theSameVideoIsOneJobAndAFinishedOneIsReadNotFetchedAgain() {
    val id = download(1)
    assertEquals(id, download(1))
    taken(); queue.complete(id, "7")
    assertEquals(id, download(1))
    // The file was deleted since: that job says so, and there is a new one.
    val again = queue.enqueue(video(1), "mp3", "Music", null) { false }
    assertNotEquals(id, again)
    assertEquals("missing", status(id))
  }

  @Test fun pausedNothingNewStarts() {
    val ready = download(1); name("Faint")
    queue.setPaused(true)
    assertTrue(queue.stateChanged)
    assertTrue(queue.next(quiet) is Next.Idle)
    assertFalse(queue.wants(quiet))
    assertNull(claimed())
    queue.setPaused(false)
    assertTrue(queue.wants(quiet))
    assertEquals(ready, taken())
  }

  @Test fun whatIsUnderWayWhenItIsPausedFinishes() {
    val id = download(1); download(2)
    taken()
    queue.setPaused(true)
    queue.change(id, "downloading", 50)
    queue.complete(id, "1")
    assertEquals("done", status(id))
    assertTrue(queue.next(quiet) is Next.Idle)
  }

  @Test fun aNameIsLookedForWhenItIsFirstAndBecomesADownloadInItsPlace() {
    val faint = queue.enqueueFind(named("Faint").put("placement", place(7)).put("discoveryTitle", "Faint"), "mp3", "Music", null, here)
    val numb = name("Numb")
    assertEquals("", job(faint).getJSONObject("video").getString("id"))
    assertEquals(faint, claimed())
    assertEquals("finding", status(faint))
    // One search at a time, and no download beside it.
    assertNull(claimed())
    assertTrue(queue.next(quiet) is Next.Wait)

    queue.resolveFind(faint, video(1).put("title", "Linkin Park - Faint (Official Audio)"), here)
    assertEquals(listOf(faint, numb), order())
    val video = job(faint).getJSONObject("video")
    assertFalse(video.has("find"))
    assertEquals(videoId(1), video.getString("id"))
    assertEquals(YouTubeData.url(videoId(1)), video.getString("url"))
    assertEquals("Linkin Park - Faint (Official Audio)", video.getString("title"))
    assertEquals("Faint", video.getString("discoveryTitle"))
    assertEquals(7, video.getJSONObject("placement").getInt("track"))
    // The download it has become comes before the name behind it.
    assertNull(claimed())
    assertEquals(faint, taken())
    assertNull(claimed())
  }

  @Test fun aNameBehindADownloadWaitsForItAndADownloadDoesNotWaitForAName() {
    val ready = download(1); val faint = name("Faint")
    assertNull(claimed())
    assertEquals(ready, taken())
    queue.complete(ready, "1")
    muchLater()
    val late = download(2)
    assertEquals(listOf(faint, late), order())
    // Nobody is looking, and nothing ended lately: the download goes.
    assertEquals(late, taken())
  }

  @Test fun afterEachPieceOfWorkANameAheadHasAMomentToBeClaimed() {
    val first = download(1); val faint = name("Faint"); val last = download(2)
    assertEquals(first, taken())
    queue.complete(first, "1")
    val wait = queue.next(quiet)
    assertTrue(wait is Next.Wait)
    assertEquals(DownloadQueue.FIND_WINDOW_MS, (wait as Next.Wait).millis)
    now += 500
    assertEquals(1_500L, (queue.next(quiet) as Next.Wait).millis)
    assertEquals(faint, claimed())
    now += 5_000
    // Being looked for: the worker holds, however long the window has been shut.
    assertTrue(queue.next(quiet) is Next.Wait)
    queue.resolveFind(faint, video(3), here)
    assertEquals(faint, taken())
    queue.complete(faint, "3")
    // Nothing to look for ahead of it now, so nothing to stand back for.
    assertEquals(last, taken())
  }

  @Test fun theWindowShutsAndTheDownloadGoes() {
    val first = download(1); name("Faint"); val last = download(2)
    taken(); queue.complete(first, "1")
    now += DownloadQueue.FIND_WINDOW_MS
    assertEquals(last, taken())
    assertNull(claimed())
  }

  @Test fun withOnlyNamesTheWorkerStaysWhileSomebodyIsLooking() {
    name("Faint")
    // Asking for it counted as somebody being there.
    assertTrue(queue.next(quiet) is Next.Wait)
    assertTrue(queue.wants(quiet))
    now += DownloadQueue.FINDER_PATIENCE_MS
    assertTrue(queue.next(quiet) is Next.Idle)
    assertFalse(queue.wants(quiet))
    // A claim that is refused is still somebody asking.
    assertNull(queue.claimFind(Outside(handBusy = true)))
    assertTrue(queue.wants(quiet))
  }

  @Test fun aSearchMadeByHandHoldsTheQueue() {
    val ready = download(1)
    val typing = Outside(handBusy = true)
    assertTrue(queue.next(typing) is Next.Wait)
    assertEquals("queued", status(ready))
    val faint = name("Faint")
    queue.move(faint, ready)
    assertNull(queue.claimFind(typing))
    assertEquals(faint, claimed())
  }

  @Test fun aSearchThatGaveWayIsMadeAgainInItsPlace() {
    val faint = name("Faint"); val numb = name("Numb")
    claimed()
    queue.requeueFind(faint)
    assertEquals(listOf(faint, numb), order())
    assertEquals(faint, claimed())
  }

  @Test fun noneThatFitsIsAFailureOfItsOwnAndRetryLooksAgain() {
    val faint = name("Faint"); val numb = name("Numb")
    claimed()
    queue.resolveFind(faint, null, here)
    assertEquals("failed", status(faint))
    assertEquals("ERR_DOWNLOAD_NO_MATCH", job(faint).getString("errorCode"))
    assertEquals(now, job(faint).getLong("finishedAt"))
    assertEquals(numb, claimed())

    assertTrue(queue.retry(faint))
    // At the end, behind the one being looked for now.
    assertEquals(listOf(faint), order())
    assertEquals(faint, queue.jobs.last().getString("id"))
    assertTrue(job(faint).isNull("error"))
    assertTrue(job(faint).isNull("finishedAt"))
    assertTrue(job(faint).getJSONObject("video").has("find"))
    queue.resolveFind(numb, null, here)
    assertEquals(faint, claimed())
  }

  @Test fun aSearchThatFailedSaysWhy() {
    val faint = name("Faint")
    claimed()
    queue.failFind(faint, Failed(Failure.NETWORK))
    assertEquals("failed", status(faint))
    assertEquals("ERR_YOUTUBE_NETWORK", job(faint).getString("errorCode"))
    // Too late to say anything else of it.
    queue.resolveFind(faint, video(1), here)
    assertEquals("failed", status(faint))
  }

  @Test fun aVideoThatIsNotOneFailsTheJobRatherThanLeavingItBeingLookedFor() {
    val faint = name("Faint")
    claimed()
    assertThrows(YouTubeTrouble::class.java) { queue.resolveFind(faint, JSONObject().put("id", "nope"), here) }
    assertEquals("failed", status(faint))
  }

  @Test fun askedForTwiceANameIsOneJob() {
    val once = queue.enqueueFind(named("Faint").put("placement", place(7)), "mp3", "Music", null, here)
    assertEquals(once, queue.enqueueFind(named("Faint").put("placement", place(7).put("track", 7.0)), "mp3", "Music", null, here))
    // The same song for another record is another file.
    assertNotEquals(once, queue.enqueueFind(named("Faint").put("placement", place(2, "Live in Texas")), "mp3", "Music", null, here))
    val discover = ownNamed("Numb")
    assertEquals(discover, ownNamed("Numb"))
    assertNotEquals(discover, ownNamed("Numb", another))
    assertThrows(YouTubeTrouble::class.java) {
      queue.enqueueFind(named("x").put("find", JSONObject().put("query", " ")), "mp3", "Music", null, here)
    }
  }

  @Test fun aVideoAlreadyHereIsFiledUnderTheRecordAndNotFetchedTwice() {
    val had = download(1)
    taken(); queue.complete(had, "9")
    job(had).put("described", true).put("cleared", true)
    val faint = queue.enqueueFind(named("Faint").put("placement", place(7)).put("discoveryTitle", "Faint"), "mp3", "Music", null, here)
    muchLater()
    claimed()
    queue.resolveFind(faint, video(1), here)
    assertTrue(queue.jobs.none { it.getString("id") == faint })
    assertEquals(7, job(had).getJSONObject("video").getJSONObject("placement").getInt("track"))
    assertFalse(job(had).getBoolean("described"))
    assertFalse(job(had).getBoolean("cleared"))
    assertEquals("done", status(had))
  }

  @Test fun theSameVideoForAnotherRecordIsFetchedForThatOneToo() {
    val had = queue.enqueue(video(1).put("placement", place(2, "Live in Texas")), "mp3", "Music", null, here)
    taken(); queue.complete(had, "9")
    val faint = queue.enqueueFind(named("Faint").put("placement", place(7)), "mp3", "Music", null, here)
    muchLater()
    claimed()
    queue.resolveFind(faint, video(1), here)
    assertEquals("queued", status(faint))
    assertEquals(2, job(had).getJSONObject("video").getJSONObject("placement").getInt("track"))
  }

  @Test fun aVideoWhoseFileIsGoneIsFetchedAgain() {
    val had = download(1)
    taken(); queue.complete(had, "9")
    val faint = name("Faint")
    muchLater()
    claimed()
    queue.resolveFind(faint, video(1)) { false }
    assertEquals("missing", status(had))
    assertEquals("queued", status(faint))
  }

  @Test fun discoversOwnGoBehindWhatWasAskedForAndWaitForQuiet() {
    val mine = own(1)
    assertTrue(job(mine).getBoolean("automatic"))
    val asked = download(2)
    assertEquals(listOf(asked, mine), order())
    assertEquals(asked, taken())
    assertTrue(queue.next(quiet) is Next.Wait)
    queue.complete(asked, "2")

    // A worker that is up sits the quiet out, asleep; none is started to.
    val rest = queue.next(quiet) as Next.Wait
    assertEquals(DownloadQueue.COOL_DOWN_MS, rest.millis)
    assertFalse(rest.awake)
    assertFalse(queue.wants(quiet))
    now += DownloadQueue.COOL_DOWN_MS - 1
    assertEquals(1L, (queue.next(quiet) as Next.Wait).millis)
    assertEquals("queued", status(mine))
    now += 1
    assertTrue(queue.wants(quiet))
    assertEquals(mine, taken())
  }

  @Test fun aSearchMadeByHandCountsAsWorkToWaitAfter() {
    val mine = own(1)
    muchLater()
    queue.touch()
    assertFalse((queue.next(quiet) as Next.Wait).awake)
    now += DownloadQueue.COOL_DOWN_MS
    assertEquals(mine, taken())
  }

  @Test fun discoversOwnAreLookedForOnlyWhenNothingElseWaits() {
    val mine = ownNamed("Numb")
    val faint = name("Faint")
    muchLater()
    assertEquals(listOf(faint, mine), order())
    assertEquals(faint, claimed())
    queue.resolveFind(faint, video(1), here)
    // Asked for and still waiting to be fetched: Discover's is not looked for yet.
    assertNull(claimed())
    taken(); queue.complete(faint, "1")
    assertNull(claimed())
    now += DownloadQueue.COOL_DOWN_MS
    assertEquals(mine, claimed())
    // Found, it is fetched at once: the wait was before the search, not between the two.
    queue.resolveFind(mine, video(2), here)
    assertEquals(mine, taken())
  }

  @Test fun discoversOwnDoNotStartWhileANameSomebodyAskedForWaitsUnfound() {
    val mine = own(1); name("Faint")
    muchLater()
    assertTrue(queue.next(quiet) is Next.Idle)
    assertEquals("queued", status(mine))
  }

  @Test fun wifiOnlyIsSaidWhenItsTurnComesAndCostsTheNextNothing() {
    val first = own(1, wifiOnly = true); val second = own(2, another)
    muchLater()
    val ended = queue.lastEnded
    val mobile = Outside(wifi = { false })
    assertEquals(second, (queue.next(mobile) as Next.Take).job.getString("id"))
    assertEquals("failed", status(first))
    assertEquals("ERR_DOWNLOAD_WAITING_WIFI", job(first).getString("errorCode"))
    assertEquals(ended, queue.lastEnded)
  }

  @Test fun askedForNextOneOfDiscoversOwnIsNoLongerItsOwn() {
    val asked = download(1); val mine = own(2, wifiOnly = true)
    queue.prioritizeDiscovery(mine)
    assertEquals(listOf(mine, asked), order())
    assertFalse(job(mine).getBoolean("automatic"))
    assertFalse(job(mine).getJSONObject("video").getBoolean("discoverWifiOnly"))
    assertEquals(mine, (queue.next(Outside(wifi = { false })) as Next.Take).job.getString("id"))
  }

  @Test fun movingKeepsWhatWasAskedForAheadOfWhatWasNot() {
    val a = download(1); val b = download(2); val c = download(3)
    val x = own(4); val y = own(5, another)
    assertTrue(queue.move(c, a))
    assertEquals(listOf(c, a, b, x, y), order())
    assertTrue(queue.move(c, null))
    // To the end of its own part: not behind Discover's.
    assertEquals(listOf(a, b, c, x, y), order())
    assertTrue(queue.move(a, y))
    assertEquals(listOf(b, c, a, x, y), order())

    // The end is never behind Discover's own, whoever is moved there.
    assertTrue(queue.move(y, null))
    assertEquals(listOf(b, c, a, y, x), order())
    assertTrue(queue.move(y, null))
    assertEquals(listOf(b, c, a, y, x), order())
    assertTrue(queue.move(x, y))
    assertTrue(queue.move(y, x))
    assertTrue(job(y).getBoolean("automatic"))
    assertEquals(listOf(b, c, a, y, x), order())
    assertTrue(queue.move(x, b))
    assertFalse(job(x).getBoolean("automatic"))
    assertFalse(job(x).getJSONObject("video").getBoolean("discoverAutomatic"))
    assertEquals(listOf(x, b, c, a, y), order())
  }

  @Test fun onlyWhatIsWaitingMoves() {
    val a = download(1); val b = download(2)
    taken()
    assertFalse(queue.move(a, b))
    assertFalse(queue.move(b, a))
    assertFalse(queue.move(b, b))
    assertFalse(queue.move("nobody", null))
    queue.changed = false
    assertFalse(queue.move(b, "nobody"))
    assertFalse(queue.changed)
  }

  @Test fun retryGoesToTheEndOfWhatWasAskedFor() {
    val a = download(1); val b = download(2); val x = own(3)
    taken(); queue.change(a, "failed", error = Failed(Failure.NETWORK))
    queue.clearFinished()
    assertTrue(job(a).getBoolean("cleared"))
    assertTrue(queue.retry(a))
    assertEquals(listOf(b, a, x), order())
    assertFalse(job(a).getBoolean("cleared"))
    assertTrue(job(a).isNull("finishedAt"))
    assertTrue(job(a).isNull("errorCode"))

    // Pressed on one of Discover's own, it has been asked for.
    queue.cancel(x)
    assertEquals("cancelled", status(x))
    assertTrue(queue.retry(x))
    assertFalse(job(x).getBoolean("automatic"))
    assertEquals(listOf(b, a, x), order())
    // Nothing to do for one that is waiting, or done.
    assertFalse(queue.retry(b))
  }

  @Test fun clearingMarksAndRemovesNothing() {
    val done = download(1); val failed = download(2); val waiting = download(3)
    taken(); queue.complete(done, "1")
    taken(); queue.change(failed, "failed", error = Failed(Failure.NETWORK))
    queue.clearFinished()
    assertEquals(3, queue.jobs.size)
    assertTrue(job(done).getBoolean("cleared"))
    assertTrue(job(failed).getBoolean("cleared"))
    assertFalse(job(waiting).getBoolean("cleared"))
    // Cleared, it is still how the video is known to be here.
    assertEquals(done, download(1))
    // And one that failed is still no reason not to try.
    assertNotEquals(failed, download(2))
  }

  @Test fun cancellingSaysWhatHasToBeStopped() {
    val running = download(1); val waiting = download(2); val named = name("Faint"); val looked = name("Numb")
    taken()
    assertEquals(Stop.NOTHING, queue.cancel(waiting))
    assertEquals(Stop.NOTHING, queue.cancel(named))
    assertEquals("cancelled", status(named))
    assertEquals(Stop.DOWNLOAD, queue.cancel(running))
    assertEquals("cancelling", status(running))
    assertTrue(queue.isCancelling(running))
    queue.change(running, "downloading", 10)
    assertEquals("cancelling", status(running))
    queue.change(running, "cancelled")
    assertEquals(looked, claimed())
    assertEquals(Stop.SEARCH, queue.cancel(looked))
    assertEquals("cancelled", status(looked))
    // What the search then comes to is nobody's.
    queue.resolveFind(looked, video(5), here)
    assertEquals("cancelled", status(looked))
    assertEquals(Stop.NOTHING, queue.cancel("nobody"))
  }

  @Test fun cancelAllIsEverythingWaitingOrUnderWay() {
    val done = download(1)
    taken(); queue.complete(done, "1")
    val running = download(2); val waiting = download(3); val mine = own(4)
    taken()
    val stopped = queue.cancelAll().toMap()
    assertEquals(mapOf(running to Stop.DOWNLOAD, waiting to Stop.NOTHING, mine to Stop.NOTHING), stopped)
    assertEquals("done", status(done))
    assertEquals(listOf<String>(), order())

    val faint = name("Faint")
    queue.change(running, "cancelled")
    claimed()
    assertEquals(mapOf(faint to Stop.SEARCH), queue.cancelAll().toMap())
  }

  @Test fun whatAProcessThatDiedLeftBehind() {
    val running = download(1); val waiting = download(2); val saved = download(3); val unsaved = download(4)
    val going = download(5); val named = name("Faint")
    job(running).put("status", "downloading")
    job(saved).put("status", "saving")
    job(unsaved).put("status", "saving")
    job(going).put("status", "cancelling")
    job(named).put("status", "finding")
    val later = DownloadQueue { now }
    later.jobs.addAll(queue.jobs)
    later.recover { it.getString("id") == saved }
    assertEquals("failed", status(running))
    assertEquals("ERR_DOWNLOAD_INTERRUPTED", job(running).getString("errorCode"))
    assertEquals("queued", status(waiting))
    assertEquals("done", status(saved))
    assertEquals("failed", status(unsaved))
    assertEquals("cancelled", status(going))
    assertEquals("queued", status(named))
    assertTrue(job(named).getJSONObject("video").has("find"))
    // Nobody is looking yet, so the download does not wait to be told so.
    assertEquals(waiting, (later.next(quiet) as Next.Take).job.getString("id"))
  }

  @Test fun aJobTakenToBeLookedForAndLeftGoesBackToWaiting() {
    val faint = name("Faint")
    claimed()
    now += DownloadQueue.FIND_LEASE_MS - 1
    assertNull(claimed())
    now += 1
    // Its search is still out: not abandoned, however long it has been.
    assertNull(queue.claimFind(Outside(searching = { it == faint })))
    assertEquals("finding", status(faint))
    queue.searched(faint)
    now += DownloadQueue.FIND_LEASE_MS
    assertEquals(faint, claimed())
  }

  @Test fun theBackgroundTakesItsJobOnlyWhenItIsThatJobsTurn() {
    val asked = download(1); val mine = own(2, another); val later = own(3)
    muchLater()
    // Never anybody else's, and not Discover's while something asked for waits.
    assertNull(queue.takeById(asked, quiet))
    assertNull(queue.takeById(mine, quiet))
    assertEquals(asked, taken())
    // Nor beside a download.
    assertNull(queue.takeById(mine, quiet))
    queue.complete(asked, "1")
    // Nor before the quiet is over.
    assertNull(queue.takeById(mine, quiet))
    now += DownloadQueue.COOL_DOWN_MS
    assertNull(queue.takeById(later, quiet))
    queue.setPaused(true)
    assertNull(queue.takeById(mine, quiet))
    queue.setPaused(false)
    assertNull(queue.takeById(mine, Outside(handBusy = true)))
    assertEquals("queued", status(mine))
    assertEquals(mine, queue.takeById(mine, quiet)!!.getString("id"))
    assertEquals("preparing", status(mine))
    assertEquals(now, job(mine).getLong("startedAt"))
    // Under way, whoever started it: nothing else begins.
    assertTrue(queue.next(quiet) is Next.Wait)
    assertNull(claimed())
  }

  @Test fun theBackgroundDoesNotTakeANameOrBreakTheWifiRule() {
    val named = ownNamed("Numb"); val mine = own(2, another, wifiOnly = true)
    muchLater()
    assertNull(queue.takeById(named, quiet))
    queue.cancel(named)
    assertNull(queue.takeById(mine, Outside(wifi = { false })))
    assertEquals("ERR_DOWNLOAD_WAITING_WIFI", job(mine).getString("errorCode"))
  }

  @Test fun withOnlyNamesTheWorkerStaysWhileJavaScriptStandsWaiting() {
    name("Faint")
    muchLater()
    assertTrue(queue.next(quiet) is Next.Idle)
    val standing = Outside(finderWaiting = true)
    assertTrue(queue.next(standing) is Next.Wait)
    assertTrue(queue.wants(standing))
    assertTrue(queue.namesWaiting())
    claimed()
    assertFalse(queue.namesWaiting())
  }

  @Test fun aStoppedServiceFailsOnlyWhatItWasFetching() {
    val running = download(1); val waiting = download(2); val named = name("Faint"); val mine = own(3)
    taken()
    queue.change(running, "downloading", 30)
    queue.interrupt(Failure.STOPPED)
    assertEquals("failed", status(running))
    assertEquals("ERR_DOWNLOAD_STOPPED", job(running).getString("errorCode"))
    assertEquals(listOf(waiting, named, mine), order())

    queue.move(named, waiting)
    claimed()
    queue.interrupt(Failure.SERVICE)
    assertEquals(listOf(named, waiting, mine), order())
    assertTrue(job(named).getJSONObject("video").has("find"))
  }

  @Test fun aCancellingJobIsNotTheSameDownloadAskedForAgain() {
    val first = download(1)
    taken()
    assertEquals(first, download(1))
    queue.cancel(first)
    assertEquals("cancelling", status(first))
    val again = download(1)
    assertNotEquals(first, again)
    assertEquals("queued", status(again))
  }

  @Test fun anotherFormatIsAnotherDownloadAndTheSameFormatIsTheSameOne() {
    val mp3 = download(1)
    val original = queue.enqueue(video(1), "original", "Music", null, here)
    assertNotEquals(mp3, original)
    assertEquals(original, queue.enqueue(video(1), "original", "Music", null, here))
    taken(); queue.complete(mp3, "1")
    assertEquals(mp3, download(1))
    // Found by name, a video here already as something else is fetched as what was asked.
    queue.cancel(original)
    val named = queue.enqueueFind(named("Faint"), "original", "Music", null, here)
    muchLater()
    claimed()
    queue.resolveFind(named, video(1), here)
    assertEquals("queued", status(named))
  }

  @Test fun discoversOwnGoingBackToWaitingStepsBehindWhatWasAskedMeanwhile() {
    val mine = ownNamed("Numb"); val other = own(5, another)
    muchLater()
    assertEquals(mine, claimed())
    // Asked for while Discover's was being looked for, and so put after it.
    val asked = download(1); val more = download(2)
    queue.requeueFind(mine)
    assertEquals(listOf(asked, more, mine, other), order())

    muchLater()
    queue.cancel(asked); queue.cancel(more)
    assertEquals(mine, claimed())
    val late = download(3)
    queue.resolveFind(mine, video(4), here)
    assertEquals(listOf(late, mine, other), order())
    // And the two parts are what moving goes by.
    assertTrue(queue.move(late, null))
    assertEquals(listOf(late, mine, other), order())
  }

  @Test fun theListIsReadBackAsItWasWritten() {
    val done = download(1); val waiting = download(2)
    val named = queue.enqueueFind(named("Faint").put("placement", place(7)), "mp3", "Music", null, here)
    val mine = own(3)
    taken(); queue.complete(done, "17")
    queue.setPaused(true)
    queue.clearFinished()

    val later = DownloadQueue { now }
    later.read(queue.written())
    later.readState(queue.stateWritten())
    assertTrue(later.paused)
    assertEquals(queue.lastEnded, later.lastEnded)
    assertEquals(queue.written(), later.written())
    assertEquals(listOf(done, waiting, named, mine), later.jobs.map { it.getString("id") })
    val kept = later.jobs.first { it.getString("id") == done }
    assertEquals("17", kept.getString("trackId"))
    assertTrue(kept.getBoolean("cleared"))
    assertTrue(kept.isNull("error"))
    assertEquals(7, later.jobs[2].getJSONObject("video").getJSONObject("placement").getInt("track"))
    assertTrue(later.jobs[3].getBoolean("automatic"))
    // Still how the video is known to be here.
    assertEquals(done, later.enqueue(video(1), "mp3", "Music", null, here))
  }

  @Test fun everyStateAJobCanBeFoundInOnDiskIsRecovered() {
    val states = listOf("queued", "finding", "preparing", "downloading", "converting", "saving", "cancelling",
      "cancelled", "failed", "done", "missing")
    val ids = states.mapIndexed { index, state ->
      val id = if (state == "finding") name("Faint") else download(index + 1)
      job(id).put("status", state)
      id
    }
    val later = DownloadQueue { now }
    later.read(queue.written())
    later.recover { false }
    val after = later.jobs.associate { it.getString("id") to it.getString("status") }
    assertEquals(listOf("queued", "queued", "failed", "failed", "failed", "failed", "cancelled",
      "cancelled", "failed", "done", "missing"), ids.map { after[it] })
    // Written down, so that it is not all done again the next time.
    assertTrue(later.changed)
    val again = DownloadQueue { now }
    again.read(later.written())
    again.changed = false
    again.recover { false }
    assertFalse(again.changed)
    // A list from before the queue kept anything else is a list still.
    val old = DownloadQueue { now }
    old.read("""[{"id":"x","video":{"id":"video000001","title":"t"},"format":"mp3","discoverKey":null,"folder":"Music","status":"done","progress":100,"trackId":"3","error":null,"described":true}]""")
    old.recover { false }
    assertFalse(old.jobs[0].optBoolean("automatic"))
    assertTrue(old.jobs[0].isNull("createdAt"))
    assertEquals("x", old.enqueue(video(1), "mp3", "Music", null, here))
  }

  @Test fun fiveHundredAtATime() {
    queue.enqueueBatch((1..500).map(::video), "mp3", "Music", here)
    assertThrows(YouTubeTrouble::class.java) { download(501) }
    assertThrows(YouTubeTrouble::class.java) { name("Faint") }
    // All or none: a list that does not fit leaves the queue as it was.
    queue.cancel(order().first())
    assertThrows(YouTubeTrouble::class.java) { queue.enqueueBatch(listOf(video(601), video(602)), "mp3", "Music", here) }
    assertEquals(499, order().size)
    assertTrue(queue.jobs.none { it.getJSONObject("video").getString("id") == videoId(601) })
  }

  @Test fun failingOnlyTheJobsThatWereJustAskedFor() {
    val before = download(1); val after = download(2)
    queue.failActive(listOf(after), Failure.OPEN_SEARCH)
    assertEquals("queued", status(before))
    assertEquals("failed", status(after))
  }

  @Test fun aClockPutBackDoesNotHoldAnythingUp() {
    val mine = own(1)
    queue.touch()
    now -= 60 * 60_000
    assertEquals(mine, taken())
  }
}
