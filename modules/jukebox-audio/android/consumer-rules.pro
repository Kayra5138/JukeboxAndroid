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
