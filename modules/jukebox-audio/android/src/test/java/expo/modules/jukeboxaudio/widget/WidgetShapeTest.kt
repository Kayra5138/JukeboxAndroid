package expo.modules.jukeboxaudio.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetShapeTest {
  @Test fun `a widget is drawn by its height`() {
    assertEquals(WidgetKind.COMPACT, WidgetShape.kindFor(40f))
    assertEquals(WidgetKind.COMPACT, WidgetShape.kindFor(89f))
    assertEquals(WidgetKind.ROW, WidgetShape.kindFor(90f))
    assertEquals(WidgetKind.CARD, WidgetShape.kindFor(120f))
    assertEquals(WidgetKind.CARD, WidgetShape.kindFor(239f))
    assertEquals(WidgetKind.LARGE, WidgetShape.kindFor(240f))
  }

  @Test fun `the taller row needs every height to be tall, as it always did`() {
    // Upright a hundred, on its side seventy: the compact row it always was.
    assertEquals(WidgetKind.COMPACT, WidgetShape.kindFor(100f, leastHeightDp = 70f))
    assertEquals(WidgetKind.ROW, WidgetShape.kindFor(100f, leastHeightDp = 95f))
    // The card does not wait on the other way up.
    assertEquals(WidgetKind.CARD, WidgetShape.kindFor(180f, leastHeightDp = 70f))
  }

  @Test fun `the large widget lists as many songs as fit, whole`() {
    assertEquals(0, WidgetShape.rowsFor(WidgetKind.CARD, 400f))
    assertEquals(1, WidgetShape.rowsFor(WidgetKind.LARGE, 240f))
    assertEquals(1, WidgetShape.rowsFor(WidgetKind.LARGE, 275f))
    assertEquals(2, WidgetShape.rowsFor(WidgetKind.LARGE, 276f))
    assertEquals(4, WidgetShape.rowsFor(WidgetKind.LARGE, 360f))
    assertEquals(WidgetShape.MOST_ROWS, WidgetShape.rowsFor(WidgetKind.LARGE, 900f))
  }

  @Test fun `sizes that draw alike are one shape, the upright one`() {
    val plan = WidgetShape.plan(listOf(350f to 190f, 520f to 130f))
    assertEquals(1, plan.size)
    assertEquals(WidgetKind.CARD, plan[0].kind)
    assertEquals(190f, plan[0].heightDp)
  }

  @Test fun `sizes that differ are a shape each`() {
    val plan = WidgetShape.plan(listOf(350f to 380f, 520f to 250f))
    assertEquals(2, plan.size)
    assertEquals(listOf(4, 1), plan.map { it.rows })
    val squashed = WidgetShape.plan(listOf(350f to 150f, 520f to 80f))
    assertEquals(listOf(WidgetKind.CARD, WidgetKind.COMPACT), squashed.map { it.kind })
  }

  @Test fun `nothing known is nothing planned`() {
    assertEquals(emptyList<WidgetShape>(), WidgetShape.plan(emptyList()))
    assertEquals(emptyList<WidgetShape>(), WidgetShape.plan(listOf(0f to 0f)))
  }

  @Test fun `the next songs run on from the current one`() {
    assertEquals(listOf(3, 4, 5), WidgetShape.nextIndices(10, 2, repeatAll = false, limit = 3))
    assertEquals(listOf(8, 9), WidgetShape.nextIndices(10, 7, repeatAll = false, limit = 6))
    assertEquals(emptyList<Int>(), WidgetShape.nextIndices(10, 9, repeatAll = false, limit = 6))
  }

  @Test fun `a repeating queue comes round, but never to the current song or twice`() {
    assertEquals(listOf(9, 0, 1), WidgetShape.nextIndices(10, 8, repeatAll = true, limit = 3))
    assertEquals(listOf(2, 0), WidgetShape.nextIndices(3, 1, repeatAll = true, limit = 6))
    assertEquals(emptyList<Int>(), WidgetShape.nextIndices(1, 0, repeatAll = true, limit = 6))
  }

  @Test fun `no queue or no place in it lists nothing`() {
    assertEquals(emptyList<Int>(), WidgetShape.nextIndices(0, 0, repeatAll = true, limit = 6))
    assertEquals(emptyList<Int>(), WidgetShape.nextIndices(5, -1, repeatAll = false, limit = 6))
    assertEquals(emptyList<Int>(), WidgetShape.nextIndices(5, 1, repeatAll = false, limit = 0))
  }

  @Test fun `repeat goes round as the player's button does`() {
    assertEquals(WidgetShape.REPEAT_ALL, WidgetShape.repeatAfter(WidgetShape.REPEAT_OFF))
    assertEquals(WidgetShape.REPEAT_ONE, WidgetShape.repeatAfter(WidgetShape.REPEAT_ALL))
    assertEquals(WidgetShape.REPEAT_OFF, WidgetShape.repeatAfter(WidgetShape.REPEAT_ONE))
    assertEquals(WidgetShape.REPEAT_OFF, WidgetShape.repeatAfter(7))
  }
}
