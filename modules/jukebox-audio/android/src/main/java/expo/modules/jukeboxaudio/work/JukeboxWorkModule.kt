package expo.modules.jukeboxaudio.work

import android.os.Handler
import android.os.HandlerThread
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Long work JavaScript does behind the screen: the service that keeps a
 * lookup going ([LookupService]), and a wait that ends there.
 *
 * A timer set in JavaScript does not go off while the app is behind the
 * screen. React Native ties its timers to the screen's frames and stops them
 * with the activity, which a service in front does not change. A call that was
 * made is still answered, though, so the lookups pace themselves with this
 * when it is here: the wait is kept on a thread of its own, and the promise is
 * kept when it is over.
 *
 * A module of its own, as the lyrics are, so that a build from before it is a
 * build without it: JavaScript asks for it by name, gets nothing, and paces
 * itself with timers as it always did.
 */
class JukeboxWorkModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val alive = AtomicBoolean(true)

  companion object {
    private val waits by lazy { Handler(HandlerThread("Jukebox:Waits").apply { start() }.looper) }
  }

  override fun definition() = ModuleDefinition {
    Name("JukeboxWork")

    Events("onStop")

    OnCreate {
      val self = java.lang.ref.WeakReference(this@JukeboxWorkModule)
      LookupService.onStop = {
        self.get()?.takeIf { it.alive.get() }?.let { module ->
          runCatching { module.sendEvent("onStop", emptyMap<String, Any?>()) }
        }
      }
    }

    OnDestroy {
      alive.set(false)
      // Whatever was under way has nobody to tell any more.
      LookupService.release()
    }

    /** Answers after [ms] milliseconds, whether or not the app is in front. */
    AsyncFunction("afterAsync") { ms: Double, promise: Promise ->
      waits.postDelayed({ promise.resolve(null) }, ms.toLong().coerceAtLeast(0))
    }

    /** Starts the service, or changes what it says: see [LookupService.hold]. */
    Function("hold") { channel: String, title: String, text: String, stop: String, done: Int, total: Int ->
      LookupService.hold(context, LookupService.Words(channel, title, text, stop, done, total))
    }

    Function("release") {
      LookupService.release()
    }
  }
}
