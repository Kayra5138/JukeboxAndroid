# What the app's release build must not rename or drop when it is shrunk.
#
# Shrinking is on in release builds (see app.plugin.js). R8 follows calls, and
# cannot follow a class that is found by its name in a string; each rule here
# is for one such, and says where the name is written.

# expo-task-manager finds the loader that starts the app without a screen, for
# a background task, by the name its manifest entry gives. Renamed, the task
# service logs "Cannot initialize app loader" at every start and Discover's
# background fetch never runs.
-keep class expo.modules.adapters.react.apploader.** { *; }
-keep class expo.modules.apploader.** { *; }

# youtubedl-android ships no rules of its own, and at its first start unpacks
# Python and FFmpeg from zips with Apache Commons Compress. That library makes
# each kind of zip "extra field" it knows by Class.newInstance() on a list of
# classes, in ExtraFieldUtils' static initialiser; R8, seeing nothing call
# those constructors, removed them, so the initialiser threw, the unpacking
# failed and every search and download failed after it. Only on a phone that
# had not unpacked them before: 0.33.0 worked on a phone that had been running
# an unshrunk build and failed on a fresh install. The library's own model
# classes are read by Jackson, by reflection too. Kept whole, all three.
-keep class com.yausername.** { *; }
-keep class org.apache.commons.compress.** { *; }
-keep class com.fasterxml.jackson.** { *; }
-dontwarn org.apache.commons.compress.**
-dontwarn com.fasterxml.jackson.**

# Expo's C++ makes some errors itself, by their constructors, when JavaScript
# that Kotlin asked it to run throws (JavaScriptEvaluateException) or SQLite
# hands back a column of a kind it does not know (InvalidConvertibleException).
# Nothing in Kotlin calls those constructors, so R8 removed them, and the error
# would arrive as a NoSuchMethodError from inside the native code. Neither path
# runs in the app today; kept so that it cannot.
-keepclassmembers @expo.modules.core.interfaces.DoNotStrip class * extends java.lang.Throwable { <init>(...); }

# Errors keep their names. Expo makes a JavaScript error's code from its class
# name when none is given (ERR_REACT_CONTEXT_LOST became ERR_K), and the
# player's and tag writer's messages name the cause's class. Nothing tests
# either; this is for whoever reads them.
-keepnames class * extends java.lang.Throwable
