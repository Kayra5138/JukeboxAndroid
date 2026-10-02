/*
 * A whole MP3, decoded in this process, as mono floats at the rate asked for.
 *
 * The platform's decoder lives in another process, and every frame handed to it
 * and taken back is a round trip across that boundary. Measured on a phone,
 * those trips were three quarters of the time it took to chart a song: an MP3
 * frame is twenty-six milliseconds of sound, so a four-minute song is nine
 * thousand round trips to do a fraction of a second of arithmetic. Decoding
 * here does the arithmetic and none of the trips -- the same songs came out
 * thirty times quicker, sample for sample the same.
 *
 * minimp3_ex rather than the bare decoder, for the three things a file needs
 * that a stream does not: stepping over the ID3 tag at the front (which can
 * hold a whole cover picture, and therefore anything, including bytes that
 * look like a frame), not playing the encoder's own bookkeeping frame as
 * sound, and dropping the encoder's start-up delay so the first sample out is
 * the first sample of the song.
 *
 * minimp3 is by lieff and is in the public domain (CC0). It is fetched by the
 * build at a pinned commit rather than kept here; see build.gradle.
 */
#define MINIMP3_IMPLEMENTATION
#define MINIMP3_FLOAT_OUTPUT
#define MINIMP3_NO_STDIO
#include "minimp3_ex.h"

#include <jni.h>
#include <stdlib.h>

/* How much is asked of the decoder at a time: sixteen frames' worth. */
#define CHUNK (MINIMP3_MAX_SAMPLES_PER_FRAME * 16)

/*
 * Returns malloc'd samples and sets *count, or NULL if this is not an MP3 that
 * can be read. The caller frees.
 *
 * Mixed to mono and thinned by taking the nearest sample, with the fractional
 * position carried from one read to the next -- exactly what the Kotlin does to
 * the platform decoder's output, so the same song gives the same numbers
 * whichever of the two decoded it.
 *
 * Everything it works with is allocated per call. The decoder's state is far
 * too big for a stack and the obvious alternative is a static, which is fine
 * until two songs are charted at once and each decodes the other's frames.
 */
static float *decode(const uint8_t *data, size_t size, int wanted, size_t *count) {
  *count = 0;
  if (wanted <= 0) return NULL;

  mp3dec_ex_t *dec = (mp3dec_ex_t *)malloc(sizeof(mp3dec_ex_t));
  mp3d_sample_t *chunk = (mp3d_sample_t *)malloc(CHUNK * sizeof(mp3d_sample_t));
  float *out = NULL;
  int open = 0;

  if (!dec || !chunk) goto fail;
  if (mp3dec_ex_open_buf(dec, data, size, MP3D_SEEK_TO_SAMPLE)) goto fail;
  open = 1;

  const int channels = dec->info.channels;
  const int hz = dec->info.hz;
  if (channels <= 0 || hz <= 0) goto fail;

  const double step = (double)hz / (double)wanted;
  /* The index says how long the song is; a second of slack on top, and a
     minute's room if for some reason it does not. Grown if either was wrong. */
  size_t room = dec->samples
    ? (size_t)((double)(dec->samples / (uint64_t)channels) / step) + (size_t)wanted
    : (size_t)wanted * 60;
  out = (float *)malloc(room * sizeof(float));
  if (!out) goto fail;

  size_t made = 0;
  double at = 0.0;
  for (;;) {
    const size_t read = mp3dec_ex_read(dec, chunk, CHUNK);
    if (read == 0) break;
    const size_t frames = read / (size_t)channels;
    while (at < (double)frames) {
      const size_t frame = (size_t)at;
      float sum = 0.0f;
      for (int channel = 0; channel < channels; channel++) sum += chunk[frame * channels + channel];
      if (made == room) {
        room *= 2;
        float *more = (float *)realloc(out, room * sizeof(float));
        if (!more) goto fail;
        out = more;
      }
      out[made++] = sum / (float)channels;
      at += step;
    }
    at -= (double)frames;
  }

  mp3dec_ex_close(dec);
  free(dec);
  free(chunk);
  *count = made;
  return out;

fail:
  if (open) mp3dec_ex_close(dec);
  free(dec);
  free(chunk);
  free(out);
  return NULL;
}

JNIEXPORT jfloatArray JNICALL
Java_expo_modules_jukeboxaudio_game_Mp3_decode(JNIEnv *env, jobject self, jbyteArray data, jint wanted) {
  (void)self;
  const jsize size = (*env)->GetArrayLength(env, data);
  jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
  if (!bytes) return NULL;

  size_t count = 0;
  float *samples = decode((const uint8_t *)bytes, (size_t)size, (int)wanted, &count);
  /* Nothing was written to it, so there is nothing to copy back. */
  (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
  if (!samples || count == 0) {
    free(samples);
    return NULL;
  }

  jfloatArray out = (*env)->NewFloatArray(env, (jsize)count);
  if (out) (*env)->SetFloatArrayRegion(env, out, 0, (jsize)count, samples);
  free(samples);
  return out;
}
