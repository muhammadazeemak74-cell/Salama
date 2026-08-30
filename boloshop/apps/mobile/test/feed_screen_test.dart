import 'package:boloshop/features/feed/presentation/screens/feed_screen.dart';
import 'package:boloshop/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

/// Pumps the feed for a fixed duration.
///
/// [WidgetTester.pumpAndSettle] cannot be used anywhere on this screen: the
/// live badge and the Bolo button both run repeating animations, so the tree
/// never settles and pumpAndSettle would time out rather than fail honestly.
Future<void> pumpFeed(WidgetTester tester) async {
  await tester.pumpWidget(
    const ProviderScope(
      child: MaterialApp(home: FeedScreen()),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  setUpAll(() {
    // Otherwise every test would try to fetch Inter over the network.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  testWidgets('renders the live badge and the Bolo voice button', (tester) async {
    await pumpFeed(tester);

    expect(find.text('LIVE'), findsOneWidget);
    // 1200 viewers, rendered the way a feed renders it.
    expect(find.text('1.2k'), findsWidgets);
    expect(find.text('Bolo'), findsOneWidget);
    expect(find.text('🎙️'), findsOneWidget);
  });

  testWidgets('renders the product card with specs and both prices', (tester) async {
    await pumpFeed(tester);

    expect(
      find.text('3-Piece Unstitched Lawn Suit — Summer Collection'),
      findsOneWidget,
    );
    expect(find.textContaining('Pure lawn'), findsOneWidget);
    // Solo price on the CTA and struck through on the card.
    expect(find.text('₨ 3,500'), findsNWidgets(2));
    // Team price on the CTA and as the headline price.
    expect(find.text('₨ 2,450'), findsNWidgets(2));
    expect(find.text('COD'), findsOneWidget);
  });

  testWidgets('shows the dual call to action with the computed saving', (tester) async {
    await pumpFeed(tester);

    expect(find.text('Solo Buy'), findsOneWidget);
    expect(find.text('Team Buy'), findsOneWidget);
    expect(find.text('⚡'), findsOneWidget);
    // 3500 -> 2450 is exactly 30%, computed rather than hardcoded in the view.
    expect(find.text('Save 30%'), findsOneWidget);
  });

  testWidgets('renders the interaction rail', (tester) async {
    await pumpFeed(tester);

    expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    expect(find.byIcon(Icons.mode_comment_outlined), findsOneWidget);
    expect(find.text('Share'), findsOneWidget);
    // Store initials stand in for a merchant logo.
    expect(find.text('LL'), findsOneWidget);
  });

  testWidgets('liking fills the heart immediately', (tester) async {
    await pumpFeed(tester);

    expect(find.text('12.4k'), findsOneWidget);
    expect(find.byIcon(Icons.favorite), findsNothing);

    await tester.tap(find.byIcon(Icons.favorite_border));
    await tester.pump(const Duration(milliseconds: 300));

    // Optimistic: the heart is filled without waiting for a round trip.
    expect(find.byIcon(Icons.favorite), findsOneWidget);
    expect(find.byIcon(Icons.favorite_border), findsNothing);

    // Tapping again takes it straight back off.
    await tester.tap(find.byIcon(Icons.favorite));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    expect(find.text('12.4k'), findsOneWidget);
  });

  testWidgets('swiping up advances to the next product', (tester) async {
    await pumpFeed(tester);

    expect(find.text('Lahore Lawn House'), findsWidgets);

    await tester.fling(find.byType(FeedScreen), const Offset(0, -600), 1000);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Embroidered Chikankari Kurta'), findsOneWidget);
    expect(find.text('₨ 4,200'), findsNWidgets(2));
    expect(find.text('₨ 2,940'), findsNWidgets(2));
  });

  testWidgets('the second product is not live, so no badge is shown',
      (tester) async {
    await pumpFeed(tester);

    await tester.fling(find.byType(FeedScreen), const Offset(0, -600), 1000);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('LIVE'), findsNothing);
    // The voice button is always available; it is the app's primary input.
    expect(find.text('Bolo'), findsOneWidget);
  });

  testWidgets('the theme is dark and never falls back to light', (tester) async {
    expect(AppTheme.dark.brightness, Brightness.dark);
    expect(AppTheme.dark.scaffoldBackgroundColor, const Color(0xFF0F0F12));
  });
}
