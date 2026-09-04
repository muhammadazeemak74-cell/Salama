import 'dart:io';

import 'package:boloshop/core/theme/app_theme.dart';
import 'package:flutter_test/flutter_test.dart';

/// The fonts are bundled rather than fetched, which means nothing checks at
/// runtime that the wiring is right — a renamed file or a dropped pubspec
/// entry just renders in a fallback face on a real device. These are cheap and
/// catch exactly that.
void main() {
  final pubspec = File('pubspec.yaml').readAsStringSync();
  final assets = Directory('assets/fonts');

  test('the theme asks for the bundled family, not a downloaded one', () {
    final style = AppTheme.dark.textTheme.bodyMedium;

    expect(style?.fontFamily, 'Inter');
    expect(style?.fontFamilyFallback, contains('Noto Nastaliq Urdu'));
    expect(AppTheme.dark.textTheme.titleLarge?.fontFamily, 'Inter');
  });

  test('nothing pulls a typeface over the network', () {
    // Read from the lockfile, not pubspec.yaml, which mentions google_fonts in
    // a comment explaining why it is gone. The dependency's absence is the
    // guarantee: with no google_fonts there is no runtime-fetch path to
    // disable, and this fails if one is reintroduced.
    final lock = File('pubspec.lock').readAsStringSync();
    expect(lock, isNot(contains('google_fonts')));
  });

  test('every bundled font file is declared in pubspec.yaml', () {
    final files = assets
        .listSync()
        .whereType<File>()
        .map((file) => file.uri.pathSegments.last)
        .where((name) => name.endsWith('.ttf'))
        .toList();

    // A font on disk that pubspec does not list is dead weight in the repo
    // that never reaches the app.
    expect(files, isNotEmpty);
    for (final name in files) {
      expect(pubspec, contains('assets/fonts/$name'), reason: '$name is not declared');
    }
  });

  test('the OFL ships with the fonts it covers', () {
    // Redistributing either family requires it, and main.dart loads it from
    // the bundle to put it on the licences page.
    expect(File('assets/fonts/OFL.txt').existsSync(), isTrue);
    expect(pubspec, contains('assets/fonts/OFL.txt'));
  });

  test('Inter covers every weight the interface asks for', () {
    // 400 and 500 come from the Material text theme, 600/700/800 from the
    // screens. A weight that is declared but missing renders synthetically,
    // which on a price row is visible.
    for (final weight in [400, 500, 600, 700, 800]) {
      expect(pubspec, contains('weight: $weight'), reason: 'Inter $weight');
    }
  });
}
