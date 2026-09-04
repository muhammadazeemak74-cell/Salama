import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guards the release-only platform configuration.
///
/// None of this is exercised by a debug run or by any widget test — the whole
/// category of bug it covers only appears in an artifact someone uploaded. A
/// regenerated platform folder or a merge that drops a line would otherwise
/// surface as a one-star review.
void main() {
  final manifest = File(
    'android/app/src/main/AndroidManifest.xml',
  ).readAsStringSync();
  final gradle = File('android/app/build.gradle.kts').readAsStringSync();
  final proguard = File('android/app/proguard-rules.pro').readAsStringSync();
  final plist = File('ios/Runner/Info.plist').readAsStringSync();

  group('Android manifest', () {
    test('declares INTERNET in the manifest release builds actually use', () {
      // The Flutter template only puts this in debug/ and profile/. A release
      // APK without it has no network access at all, and every screen fails
      // with a connection error that reads as the backend being down.
      expect(manifest, contains('android.permission.INTERNET'));
    });

    test('keeps the package-visibility query url_launcher needs', () {
      // From API 30 the wa.me intent resolves to nothing without this, which
      // looks exactly like WhatsApp not being installed.
      expect(manifest, contains('android.intent.action.VIEW'));
    });
  });

  test('permits cleartext only to the loopback hosts development uses', () {
    // Without the config a development build cannot reach localhost or the
    // emulator's host alias at all, and fails with a connection error that
    // reads as the backend being down. Widening it to the whole application
    // would let the shipped app send the session JWT in the clear.
    final config = File(
      'android/app/src/main/res/xml/network_security_config.xml',
    ).readAsStringSync();

    expect(manifest, contains('@xml/network_security_config'));
    expect(config, contains('<base-config cleartextTrafficPermitted="false"'));
    for (final host in ['localhost', '127.0.0.1', '10.0.2.2']) {
      expect(config, contains('>$host<'));
    }
    // A blanket permission would defeat the point of the file.
    expect(manifest, isNot(contains('usesCleartextTraffic="true"')));
  });

  group('Android release build', () {
    test('shrinks and obfuscates', () {
      expect(gradle, contains('isMinifyEnabled = true'));
      expect(gradle, contains('isShrinkResources = true'));
    });

    test('feeds R8 the app-specific keep rules', () {
      // Default rules alone strip the reflective plugin entry points.
      expect(gradle, contains('proguard-rules.pro'));
      expect(gradle, contains('getDefaultProguardFile'));
    });

    test('compiles against the SDK flutter_secure_storage demands', () {
      // Reverting this to flutter.compileSdkVersion breaks every Android
      // build, debug included: the plugin's AAR metadata requires 37 and
      // checkAarMetadata refuses anything lower. Nothing else in the suite
      // would catch it, because no test builds for Android.
      expect(gradle, contains('compileSdk = 37'));
      expect(gradle, isNot(contains('compileSdk = flutter.compileSdkVersion')));
    });

    test('uploads native debug symbols', () {
      // Otherwise a crash in the Dart or engine .so is hexadecimal in Play
      // Console.
      expect(gradle, contains('debugSymbolLevel'));
    });

    test('signs with a real key when one is configured', () {
      expect(gradle, contains('key.properties'));
      expect(gradle, contains('signingConfigs.getByName("release")'));
    });
  });

  group('ProGuard rules', () {
    test('keeps flutter_secure_storage and the crypto it wraps', () {
      // The JWT lives here. A rule missing from this block signs users out on
      // every launch of the release build, and never in debug.
      expect(proguard, contains('com.it_nomads.fluttersecurestorage'));
      expect(proguard, contains('androidx.security.crypto'));
      expect(proguard, contains('com.google.crypto.tink'));
    });

    test('keeps the video stack the feed is built on', () {
      expect(proguard, contains('androidx.media3'));
    });

    test('keeps the Flutter embedding and its plugin registrant', () {
      expect(proguard, contains('io.flutter.embedding'));
      expect(proguard, contains('io.flutter.plugin'));
    });

    test('keeps reflection metadata and JNI names', () {
      expect(proguard, contains('-keepattributes'));
      expect(proguard, contains('native <methods>'));
    });
  });

  group('iOS Info.plist', () {
    test('explains why it wants the microphone', () {
      // iOS terminates the app outright if the microphone is requested with no
      // purpose string.
      expect(plist, contains('NSMicrophoneUsageDescription'));
      expect(plist, contains('NSSpeechRecognitionUsageDescription'));
    });

    test('can see WhatsApp before offering to open it', () {
      expect(plist, contains('LSApplicationQueriesSchemes'));
      expect(plist, contains('<string>whatsapp</string>'));
    });

    test('answers export compliance so uploads do not stall', () {
      expect(plist, contains('ITSAppUsesNonExemptEncryption'));
    });

    test('declares portrait only, matching the lock in main.dart', () {
      expect(
        RegExp(
          r'<key>UISupportedInterfaceOrientations</key>\s*<array>\s*'
          r'<string>UIInterfaceOrientationPortrait</string>\s*</array>',
        ).hasMatch(plist),
        isTrue,
        reason: 'iPhone orientations should be portrait only',
      );
    });
  });
}
