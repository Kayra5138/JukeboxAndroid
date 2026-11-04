#!/usr/bin/env bash
# FFmpeg for yt-dlp, from source, for one Android ABI: build.sh <ndk> <abi> <work> <out>
#
# What yt-dlp is asked to do with it (downloads/YouTubeEngine.kt), and so all
# this has in it:
#   - take the sound out of what it fetched as it is, or make an MP3 of it
#     (`-x --audio-format best|mp3`), which is LAME;
#   - open and write M4A, WebM/Opus, Ogg, MP3, FLAC and WAV;
#   - put the tags in, and a tape's chapters (`--embed-metadata`, `--embed-chapters`);
#   - look inside a file first, with ffprobe.
# No network (yt-dlp fetches for it), no video, no pictures. The library's own
# build had all of those and some forty libraries besides, 36 MB of the app.
#
# Both programs are linked statically, so that each is one file and nothing
# has to be unpacked before it runs: they go in as libffmpeg.so and
# libffprobe.so, which is where youtubedl-android points yt-dlp
# (`--ffmpeg-location`, under the app's native library folder).
#
# The sources are pinned by hash. FFmpeg is GitHub's archive of the commit
# tagged n9.0.2, which is ffmpeg.org's release tarball file for file but for
# the VERSION file written below; LAME is SourceForge's 3.100 tarball.
set -euo pipefail

NDK=$1
ABI=$2
WORK=$3
OUT=$4
API=29

FFMPEG_COMMIT=946fcce07b6dcd0331c8cc609192aeff5e1924f8
FFMPEG_VERSION=9.0.2
FFMPEG_SHA256=0aa2b1de2a5698b20a23e93d539a9a8e82ca0117496c5bdf05d198805f42bb3b
LAME_VERSION=3.100
LAME_SHA256=ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e

case "$ABI" in
  arm64-v8a)   TRIPLE=aarch64-linux-android;     CLANG=aarch64-linux-android$API;     ARCH=aarch64; ASM=() ;;
  armeabi-v7a) TRIPLE=arm-linux-androideabi;     CLANG=armv7a-linux-androideabi$API;  ARCH=arm;     ASM=(--enable-neon) ;;
  # x86 assembly wants nasm, which a build machine need not have; the C is quick enough for this.
  x86_64)      TRIPLE=x86_64-linux-android;      CLANG=x86_64-linux-android$API;      ARCH=x86_64;  ASM=(--disable-x86asm) ;;
  x86)         TRIPLE=i686-linux-android;        CLANG=i686-linux-android$API;        ARCH=x86;     ASM=(--disable-x86asm --disable-inline-asm) ;;
  *) echo "ffmpeg: no build for $ABI" >&2; exit 1 ;;
esac

TOOLS=$(echo "$NDK"/toolchains/llvm/prebuilt/*)
CC=$TOOLS/bin/$CLANG-clang
JOBS=$(nproc 2>/dev/null || echo 4)

fetch() { # url sha256 file
  [ -f "$3" ] && echo "$2  $3" | sha256sum -c --quiet - 2>/dev/null && return
  rm -f "$3"
  curl -sSfL --retry 3 -m 600 -o "$3.part" "$1"
  echo "$2  $3.part" | sha256sum -c --quiet - || { echo "ffmpeg: checksum mismatch for $1" >&2; rm -f "$3.part"; exit 1; }
  mv "$3.part" "$3"
}

mkdir -p "$WORK"
cd "$WORK"
fetch "https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/$FFMPEG_COMMIT" $FFMPEG_SHA256 ffmpeg.tar.gz
fetch "https://downloads.sourceforge.net/project/lame/lame/$LAME_VERSION/lame-$LAME_VERSION.tar.gz" $LAME_SHA256 lame.tar.gz

BUILD=$WORK/$ABI
rm -rf "$BUILD"
mkdir -p "$BUILD"
tar xf ffmpeg.tar.gz -C "$BUILD"
tar xf lame.tar.gz -C "$BUILD"
FFMPEG_SRC=$BUILD/FFmpeg-$FFMPEG_COMMIT
echo "$FFMPEG_VERSION" > "$FFMPEG_SRC/VERSION"
PREFIX=$BUILD/prefix

# LAME, the encoder alone: FFmpeg decodes for it.
(
  cd "$BUILD/lame-$LAME_VERSION"
  CC=$CC AR=$TOOLS/bin/llvm-ar RANLIB=$TOOLS/bin/llvm-ranlib CFLAGS="-O2 -fPIC" \
    ./configure --host=$TRIPLE --prefix="$PREFIX" --enable-static --disable-shared \
      --disable-frontend --disable-decoder --disable-gtktest --with-pic >"$BUILD/lame.log" 2>&1 \
    && make -j"$JOBS" >>"$BUILD/lame.log" 2>&1 && make install >>"$BUILD/lame.log" 2>&1 \
    || { tail -40 "$BUILD/lame.log" >&2; exit 1; }
)

(
  cd "$FFMPEG_SRC"
  ./configure \
    --prefix="$PREFIX" --target-os=android --arch=$ARCH --enable-cross-compile \
    --cc="$CC" --cxx="$CC++" --ld="$CC" --ar="$TOOLS/bin/llvm-ar" --nm="$TOOLS/bin/llvm-nm" \
    --ranlib="$TOOLS/bin/llvm-ranlib" --strip="$TOOLS/bin/llvm-strip" \
    --enable-static --disable-shared --enable-pic "${ASM[@]}" \
    --disable-autodetect --disable-doc --disable-debug --disable-network \
    --disable-everything --disable-avdevice --disable-swscale --disable-ffplay \
    --enable-ffmpeg --enable-ffprobe \
    --enable-protocol=file,pipe \
    --enable-demuxer=mov,matroska,ogg,mp3,aac,loas,flac,wav,ffmetadata \
    --enable-muxer=ipod,mp4,mov,matroska,webm,ogg,opus,mp3,adts,flac,wav,ffmetadata,null \
    --enable-decoder=aac,aac_latm,mp3,mp3float,mp2,mp2float,opus,vorbis,flac,alac,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s32le,pcm_f32le,pcm_u8 \
    --enable-encoder=libmp3lame \
    --enable-parser=aac,aac_latm,flac,mpegaudio,opus,vorbis \
    --enable-bsf=aac_adtstoasc \
    --enable-filter=abuffer,abuffersink,aformat,anull,aresample,atrim,buffer,buffersink,format,null \
    --enable-libmp3lame \
    --extra-cflags="-I$PREFIX/include" \
    --extra-ldflags="-L$PREFIX/lib -Wl,-z,max-page-size=16384" >"$BUILD/configure.log" 2>&1 \
    || { tail -40 "$BUILD/configure.log" >&2; tail -40 ffbuild/config.log >&2; exit 1; }
  make -j"$JOBS" >"$BUILD/make.log" 2>&1 || { tail -40 "$BUILD/make.log" >&2; exit 1; }
)

mkdir -p "$OUT/$ABI"
"$TOOLS/bin/llvm-strip" -o "$OUT/$ABI/libffmpeg.so" "$FFMPEG_SRC/ffmpeg"
"$TOOLS/bin/llvm-strip" -o "$OUT/$ABI/libffprobe.so" "$FFMPEG_SRC/ffprobe"
rm -rf "$BUILD"
