package expo.modules.jukeboxaudio.downloads

import expo.modules.jukeboxaudio.downloads.YouTubeGate.For
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/*
  The door, with threads standing in for the work. Each piece of work here is
  a latch: it has the turn from when it says it has begun until it is let go.
*/
class YouTubeGateTest {
  private val gate = YouTubeGate()

  /** Work that holds its turn until it is released, or until its token is set. */
  private inner class Work(val what: For) {
    val cancelled = AtomicBoolean(false)
    val began = CountDownLatch(1)
    val ended = CountDownLatch(1)
    val error = AtomicReference<Throwable?>(null)
    private val release = CountDownLatch(1)
    private val thread = thread {
      try {
        gate.hold(what, cancelled) {
          began.countDown()
          // As a search is stopped: by its token, looked at every so often.
          while (!release.await(10, TimeUnit.MILLISECONDS)) check(!cancelled.get()) { "Cancelled" }
        }
      } catch (caught: Throwable) { error.set(caught) }
      finally { ended.countDown() }
    }
    fun begun(within: Long = 2_000) = began.await(within, TimeUnit.MILLISECONDS)
    /** Given every chance to begin, it has not. */
    fun waiting() = !began.await(300, TimeUnit.MILLISECONDS)
    fun finish() { release.countDown(); assertTrue(ended.await(2, TimeUnit.SECONDS)); thread.join(2_000) }
    fun over() = ended.await(2, TimeUnit.SECONDS)
  }

  @Test fun oneDownloadAtATime() {
    val first = Work(For.DOWNLOAD); assertTrue(first.begun())
    val second = Work(For.DOWNLOAD)
    assertTrue(second.waiting())
    first.finish()
    assertTrue(second.begun())
    second.finish()
  }

  @Test fun theQueuesSearchIsNeverBesideADownload() {
    val download = Work(For.DOWNLOAD); assertTrue(download.begun())
    val search = Work(For.FIND)
    assertTrue(search.waiting())
    download.finish()
    assertTrue(search.begun())
    val next = Work(For.DOWNLOAD)
    assertTrue(next.waiting())
    val other = Work(For.FIND)
    assertTrue(other.waiting())
    search.finish()
    // One of the two, and only one.
    assertTrue(next.begun(600) != other.begun(600))
    next.cancelled.set(true); other.cancelled.set(true)
    assertTrue(next.over()); assertTrue(other.over())
  }

  @Test fun aSearchMadeByHandDoesNotWaitForADownload() {
    val download = Work(For.DOWNLOAD); assertTrue(download.begun())
    val typed = Work(For.HAND)
    assertTrue(typed.begun())
    assertTrue(gate.handBusy)
    typed.finish(); download.finish()
    assertFalse(gate.handBusy)
  }

  @Test fun theQueueStartsNothingWhileASearchMadeByHandIsInFlightOrWaiting() {
    val typed = Work(For.HAND); assertTrue(typed.begun())
    val download = Work(For.DOWNLOAD); val search = Work(For.FIND)
    assertTrue(download.waiting()); assertTrue(search.waiting())
    // A second one typed stands behind the first, and the queue behind both.
    val again = Work(For.HAND)
    assertTrue(again.waiting())
    typed.finish()
    assertTrue(again.begun())
    assertTrue(download.waiting()); assertTrue(search.waiting())
    again.finish()
    assertTrue(download.begun(600) != search.begun(600))
    download.cancelled.set(true); search.cancelled.set(true)
    assertTrue(download.over()); assertTrue(search.over())
  }

  @Test fun theQueuesSearchGivesWayToOneMadeByHand() {
    val search = Work(For.FIND); assertTrue(search.begun())
    val typed = Work(For.HAND)
    assertTrue(search.over())
    assertTrue(search.error.get() is YouTubeGate.GaveWay)
    assertTrue(typed.begun())
    typed.finish()
    // And the next of the queue's is not told it gave way to anything.
    val later = Work(For.FIND); assertTrue(later.begun())
    later.cancelled.set(true)
    assertTrue(later.over())
    assertFalse(later.error.get() is YouTubeGate.GaveWay)
  }

  @Test fun aSearchStillWaitingCanBeCancelledAndLeavesNothingBehind() {
    val typed = Work(For.HAND); assertTrue(typed.begun())
    val waiting = Work(For.HAND)
    assertTrue(waiting.waiting())
    waiting.cancelled.set(true)
    assertTrue(waiting.over())
    assertTrue(waiting.error.get() is IllegalStateException)
    assertTrue(gate.handBusy)
    typed.finish()
    assertFalse(gate.handBusy)
    val download = Work(For.DOWNLOAD); assertTrue(download.begun())
    download.finish()
  }

  @Test fun aDownloadCancelledWhileItWaitsNeverHadATurn() {
    val typed = Work(For.HAND); assertTrue(typed.begun())
    val download = Work(For.DOWNLOAD)
    assertTrue(download.waiting())
    download.cancelled.set(true)
    assertTrue(download.over())
    typed.finish()
    val search = Work(For.FIND); assertTrue(search.begun())
    search.finish()
  }

  @Test fun workThatThrowsGivesUpItsTurn() {
    for (what in For.values()) {
      assertThrows(IllegalArgumentException::class.java) {
        gate.hold(what, AtomicBoolean(false)) { throw IllegalArgumentException("broke") }
      }
    }
    assertFalse(gate.handBusy)
    assertEquals("after", gate.hold(For.DOWNLOAD, AtomicBoolean(false)) { "after" })
    assertEquals("after", gate.hold(For.FIND, AtomicBoolean(false)) { "after" })
  }

  @Test fun workAlreadyCancelledIsNotBegun() {
    assertThrows(IllegalStateException::class.java) { gate.hold(For.HAND, AtomicBoolean(true)) { fail("begun") } }
    assertFalse(gate.handBusy)
  }
}
