# The tag writer: TagLib, compiled from its source, and the little of the app's
# own that sits on top of it.
#
# Not the module's CMake build. That one belongs to the translation engine --
# the Android plugin allows a module a single CMake file and the engine's is
# unpacked from its archive -- so this is run by tasks of its own in
# build.gradle, which is also where the two source trees it needs are fetched
# and checked and where their paths come from.
cmake_minimum_required(VERSION 3.22)
project(jukeboxtags CXX)

set(JUKEBOX_TAGLIB "" CACHE PATH "TagLib's source, as unpacked by build.gradle")
set(JUKEBOX_UTFCPP "" CACHE PATH "utfcpp's source, likewise")
if(NOT EXISTS "${JUKEBOX_TAGLIB}/CMakeLists.txt" OR NOT EXISTS "${JUKEBOX_UTFCPP}/source/utf8.h")
  message(FATAL_ERROR "JUKEBOX_TAGLIB and JUKEBOX_UTFCPP must point at the fetched sources.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
# Each function in a section of its own, so that the linker can leave out
# every one nothing reaches. Most of TagLib is formats this never opens.
add_compile_options(-ffunction-sections -fdata-sections)

# A static library with its symbols kept to itself: the only things anything
# outside needs to find are the two JNI functions.
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(VISIBILITY_HIDDEN ON CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(BUILD_BINDINGS OFF CACHE BOOL "" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)

# MP3 is always built; FLAC comes with the Vorbis comments it keeps its tags
# in. Everything else is switched off rather than left for the linker to drop,
# because what is never compiled is also never waited for.
set(WITH_VORBIS ON CACHE BOOL "" FORCE)
foreach(unused APE ASF DSF MATROSKA MOD MP4 RIFF SHORTEN TRUEAUDIO)
  set(WITH_${unused} OFF CACHE BOOL "" FORCE)
endforeach()

# zlib stays. An ID3v2 frame may be stored compressed, and without zlib TagLib
# cannot open such a frame and so cannot be trusted to carry it across a
# rewrite. On Android it is the system's own libz.so, which every version has
# and which therefore adds nothing to the APK.
set(WITH_ZLIB ON CACHE BOOL "" FORCE)
find_package(ZLIB REQUIRED)

# TagLib wants utfcpp, which it keeps as a git submodule and which an archive
# of a commit therefore does not contain. Telling it where the headers are is
# all it takes: they are the whole library.
set(utf8cpp_INCLUDE_DIR "${JUKEBOX_UTFCPP}/source" CACHE PATH "" FORCE)

add_subdirectory("${JUKEBOX_TAGLIB}" taglib EXCLUDE_FROM_ALL)

# TagLib describes its headers only as they are once installed, and this is
# never installed, so the directories are named as they are in the source.
add_library(jukeboxtags_core STATIC jukebox_tags.cpp)
target_include_directories(jukeboxtags_core
  PUBLIC
    "${CMAKE_CURRENT_BINARY_DIR}/taglib"
    "${JUKEBOX_TAGLIB}/taglib"
    "${JUKEBOX_TAGLIB}/taglib/toolkit"
    "${JUKEBOX_TAGLIB}/taglib/mpeg"
    "${JUKEBOX_TAGLIB}/taglib/mpeg/id3v1"
    "${JUKEBOX_TAGLIB}/taglib/mpeg/id3v2"
    "${JUKEBOX_TAGLIB}/taglib/mpeg/id3v2/frames"
    "${JUKEBOX_TAGLIB}/taglib/flac"
    "${JUKEBOX_TAGLIB}/taglib/ogg"
    "${JUKEBOX_TAGLIB}/taglib/ogg/flac")
target_compile_options(jukeboxtags_core PRIVATE -Wall -Wextra)
target_link_libraries(jukeboxtags_core PUBLIC tag ZLIB::ZLIB)

if(ANDROID)
  add_library(jukeboxtags SHARED jukebox_tags_jni.cpp)
  set_target_properties(jukeboxtags PROPERTIES CXX_VISIBILITY_PRESET hidden)
  target_link_libraries(jukeboxtags PRIVATE jukeboxtags_core)
  target_link_options(jukeboxtags PRIVATE
    -Wl,--gc-sections
    -Wl,--exclude-libs,ALL
    # Sixteen-kilobyte pages, which newer phones use and older ones do not mind.
    -Wl,-z,max-page-size=16384
    -Wl,--strip-all)
else()
  # See jukebox_tags_check.cpp. Only ever built for the machine doing the building.
  add_executable(jukebox_tags_check jukebox_tags_check.cpp)
  target_link_libraries(jukebox_tags_check PRIVATE jukeboxtags_core)
endif()
