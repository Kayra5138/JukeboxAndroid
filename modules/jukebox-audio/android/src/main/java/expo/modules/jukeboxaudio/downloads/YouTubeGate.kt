package expo.modules.jukeboxaudio.downloads

import java.util.concurrent.atomic.AtomicBoolean

/**
 * The one door every request to YouTube goes through.
 *
 * The queue's rules say whose turn it is; this is what makes a turn a turn,
 * whoever is asking and from whichever thread. Three kinds of work come to it:
 *
 *  - a download, of which there is one at a time;
 *  - a search made for the queue, for a job asked for by name: one at a
 *    time, and never beside a download;
 *  - a search somebody typed, or a playlist they asked to be read: one at a
 *    time among themselves, and not kept waiting by a download, which may be
 *    half an hour of somebody else's album.
 *
 * Somebody typing comes first. While their search is in flight, or waiting
 * for the one before it, the queue starts nothing new; and a search the
 * queue has in flight gives way to it, is stopped, and is made again in its
 * turn. So the most that is ever asked of YouTube at once is one search by
 * hand beside one download already under way, which is what the app did
 * before there was a queue to ask, and nothing the queue does of its own
 * accord is ever beside anything.
 *
 * A fourth kind is not a request to YouTube at all: the extractor itself
 * being changed for a newer one, or put back (see [ExtractorUpdate]). The
 * file every one of the others runs is taken away and another put in its
 * place, so it has the door to itself: it waits for whatever is in flight to
 * end, a search made by hand included, and nothing begins until it is done.
 * While it waits the queue starts nothing new, or a run of downloads would
 * keep it waiting for the length of an album; somebody typing still goes
 * ahead of it, as they go ahead of everything.
 *
 * Whoever waits here can still be cancelled: the wait looks at the same
 * token the work would have been stopped by.
 */
class YouTubeGate {
  enum class For { DOWNLOAD, FIND, HAND, UPDATE }

  /** The queue's search was stopped for one made by hand. Not a failure: it is to be made again. */
  class GaveWay : Exception("The search gave way to one made by hand.")

  private val lock = Object()
  private var downloading = false
  /** The token of the queue's search in flight, which is how it is told to give way. */
  private var finding: AtomicBoolean? = null
  private var gaveWay = false
  private var hand = false
  private var handsWaiting = 0
  private var updating = false
  private var updatesWaiting = 0

  /** A search made by hand is in flight, or waiting to be. */
  val handBusy: Boolean get() = synchronized(lock) { hand || handsWaiting > 0 }

  /** The extractor is being changed, or waiting to be: nothing of the queue's is to start. */
  val updateBusy: Boolean get() = synchronized(lock) { updating || updatesWaiting > 0 }

  /** Does [work] once it is [what]'s turn, and gives the turn up however the work ends. */
  fun <T> hold(what: For, cancelled: AtomicBoolean, work: () -> T): T {
    enter(what, cancelled)
    try { return work() }
    catch (error: Exception) {
      // Read before the turn is given up, which is what forgets it.
      if (what == For.FIND && synchronized(lock) { gaveWay }) throw GaveWay()
      throw error
    } finally { leave(what) }
  }

  private fun waitUntil(cancelled: AtomicBoolean, free: () -> Boolean) {
    while (true) {
      check(!cancelled.get()) { "Cancelled" }
      if (free()) return
      // Not for ever: a cancellation is a flag somebody set, and wakes nobody.
      lock.wait(100)
    }
  }

  private fun enter(what: For, cancelled: AtomicBoolean) = synchronized(lock) {
    if (what == For.HAND) {
      handsWaiting++
      try {
        finding?.let { gaveWay = true; it.set(true) }
        waitUntil(cancelled) { !hand && finding == null && !updating }
        hand = true
      } finally {
        handsWaiting--
        lock.notifyAll()
      }
    } else if (what == For.UPDATE) {
      updatesWaiting++
      try {
        waitUntil(cancelled) { !updating && !downloading && finding == null && !hand && handsWaiting == 0 }
        updating = true
      } finally {
        updatesWaiting--
        lock.notifyAll()
      }
    } else {
      waitUntil(cancelled) { !downloading && finding == null && !hand && handsWaiting == 0 && !updating && updatesWaiting == 0 }
      if (what == For.DOWNLOAD) downloading = true
      else { finding = cancelled; gaveWay = false }
    }
  }

  private fun leave(what: For) = synchronized(lock) {
    when (what) {
      For.DOWNLOAD -> downloading = false
      For.FIND -> { finding = null; gaveWay = false }
      For.HAND -> hand = false
      For.UPDATE -> updating = false
    }
    lock.notifyAll()
  }
}
