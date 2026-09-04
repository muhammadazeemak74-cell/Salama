# R8 / ProGuard keep rules for BoloShop release builds.
#
# WHAT THIS DOES AND DOES NOT COVER
#
# R8 only sees the Java and Kotlin half of the app: the Flutter embedding and
# the plugins' Android implementations. Dart is compiled ahead of time into
# libapp.so and is never touched by it — so the app's own models, the JSON
# parsing in feature/*/domain, and every `fromJson` in lib/ need no rules here
# and would not be helped by one. What does need rules is anything reached by
# reflection on the Android side, because R8 cannot see a call that is a string
# at runtime and will happily strip its target.
#
# Symptom of a missing rule: the debug build works, the release build throws
# ClassNotFoundException / NoSuchMethodError, or a plugin silently returns null.

# --- Reflection metadata -----------------------------------------------------
# Generic signatures and annotations survive, so reflective lookups that read
# them still resolve after shrinking.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepattributes SourceFile, LineNumberTable
# Keeps crash stack traces readable while still obfuscating names.
-renamesourcefileattribute SourceFile

# --- Flutter engine and embedding -------------------------------------------
# The engine looks plugins up by name from GeneratedPluginRegistrant, and the
# platform channels are resolved reflectively.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-dontwarn io.flutter.embedding.**

# --- flutter_secure_storage --------------------------------------------------
# The JWT lives here, so a rule missing from this block is a user who is
# silently signed out on every launch of the release build — and never in
# debug, which is the worst way to find out.
#
# The plugin wraps androidx.security.crypto, which wraps Google Tink. Tink
# builds its key managers by reflecting on protobuf-generated classes, and its
# registry is populated from string identifiers R8 cannot follow.
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.crypto.tink.proto.** { *; }
-keepclassmembers class * extends com.google.crypto.tink.shaded.protobuf.GeneratedMessageLite {
  <fields>;
}
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**

# --- video_player (Media3 / ExoPlayer) ---------------------------------------
# The feed is the product. Media3 selects renderers, extractors and decoders by
# class name at runtime, so a stripped one is a video that never plays.
-keep class androidx.media3.** { *; }
-keep interface androidx.media3.** { *; }
-dontwarn androidx.media3.**
# Older ExoPlayer artifacts, still pulled in transitively by some versions.
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# --- url_launcher ------------------------------------------------------------
# Opens the wa.me confirmation and team-invite links.
-keep class io.flutter.plugins.urllauncher.** { *; }

# --- path_provider -----------------------------------------------------------
-keep class io.flutter.plugins.pathprovider.** { *; }

# --- Play Core ---------------------------------------------------------------
# Flutter's embedding references the deferred-components API, which is not on
# the classpath unless the app actually uses deferred components. Without this,
# R8 fails the build on missing classes rather than warning.
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# --- Kotlin ------------------------------------------------------------------
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
  <fields>;
}

# --- Android platform --------------------------------------------------------
# Enum values()/valueOf() and Parcelable CREATOR are both reached reflectively
# by the framework.
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
-keepclassmembers class * implements android.os.Parcelable {
  public static final ** CREATOR;
}
-keepclassmembers class * implements java.io.Serializable {
  static final long serialVersionUID;
  private static final java.io.ObjectStreamField[] serialPersistentFields;
  private void writeObject(java.io.ObjectOutputStream);
  private void readObject(java.io.ObjectInputStream);
  java.lang.Object writeReplace();
  java.lang.Object readResolve();
}

# --- Native methods ----------------------------------------------------------
# Renaming either side of a JNI boundary breaks it.
-keepclasseswithmembernames class * {
  native <methods>;
}
