import 'package:boloshop/core/theme/app_theme.dart';
import 'package:boloshop/features/voice/domain/voice_filter.dart';
import 'package:boloshop/features/voice/presentation/widgets/voice_search_modal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The scripted capture runs on timers, and the waveform repeats forever —
/// so pumpAndSettle can never be used here. These advance the clock explicitly.
const _toTranscribing = Duration(milliseconds: 1700);
const _toReady = Duration(milliseconds: 800);

Future<void> pumpModal(
  WidgetTester tester, {
  Set<VoiceFilter> initial = const {},
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: VoiceSearchModal(initialFilters: initial)),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
}

Future<void> advanceToReady(WidgetTester tester) async {
  await tester.pump(_toTranscribing);
  await tester.pump(_toReady);
}

/// Replaces the sheet with an empty tree, which disposes it — the same path a
/// dismissal takes in the app.
Future<void> disposeModal(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

void main() {
  testWidgets('opens listening in Roman Urdu', (tester) async {
    await pumpModal(tester);

    expect(find.text('Listening in Roman Urdu…'), findsOneWidget);
    expect(find.text('Bolo'), findsOneWidget);
    // The scripted capture is labelled, not passed off as a live recogniser.
    expect(find.text('Demo'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);

    await disposeModal(tester);
  });

  testWidgets('reveals the parsed transcript and the chips it produced', (
    tester,
  ) async {
    await pumpModal(tester);
    await advanceToReady(tester);

    expect(find.text('“3,000 PKR tak ka lawn suit”'), findsOneWidget);
    expect(find.text('Yeh mila — tap to change'), findsOneWidget);

    // All three chips are always offered; two are pre-selected from the query.
    expect(find.text('Lawn Suits'), findsOneWidget);
    expect(find.text('< ₨ 3,000'), findsOneWidget);
    expect(find.text('Free Delivery'), findsOneWidget);
    expect(find.text('Show 2 filters'), findsOneWidget);
  });

  testWidgets('a chip can be turned off and another turned on', (tester) async {
    await pumpModal(tester);
    await advanceToReady(tester);

    await tester.tap(find.text('Lawn Suits'));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('Show 1 filter'), findsOneWidget);

    await tester.tap(find.text('Free Delivery'));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('Show 2 filters'), findsOneWidget);
  });

  testWidgets('chips are inert until the capture finishes', (tester) async {
    await pumpModal(tester);

    // Tapping mid-listen must not apply a filter that has not been parsed yet.
    await tester.tap(find.text('Free Delivery'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Show 1 filter'), findsNothing);

    await disposeModal(tester);
  });

  testWidgets('clearing every chip offers to show everything', (tester) async {
    await pumpModal(tester);
    await advanceToReady(tester);

    await tester.tap(find.text('Lawn Suits'));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.tap(find.text('< ₨ 3,000'));
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.text('Show everything'), findsOneWidget);
  });

  testWidgets('reopening starts from the filters already on the feed', (
    tester,
  ) async {
    await pumpModal(tester, initial: {VoiceFilter.freeDelivery});

    // Before the capture overwrites it, the existing selection is what shows.
    expect(find.text('Show 1 filter'), findsOneWidget);

    await disposeModal(tester);
  });

  testWidgets('applying returns the chosen filters and the transcript', (
    tester,
  ) async {
    VoiceSearchResult? result;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await VoiceSearchModal.show(context);
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await advanceToReady(tester);

    await tester.tap(find.text('Show 2 filters'));
    await tester.pump(const Duration(milliseconds: 400));

    expect(result, isNotNull);
    expect(result!.filters, {
      VoiceFilter.lawnSuits,
      VoiceFilter.underThreeThousand,
    });
    expect(result!.transcript, '3,000 PKR tak ka lawn suit');
  });

  testWidgets('dismissing without applying returns nothing', (tester) async {
    VoiceSearchResult? result;
    var closed = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await VoiceSearchModal.show(context);
                closed = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // Tap the barrier.
    await tester.tapAt(const Offset(200, 60));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(closed, isTrue);
    expect(result, isNull);
  });

  testWidgets('cancels its timers when dismissed mid-capture', (tester) async {
    await pumpModal(tester);
    // Disposing while the scripted capture is still pending must leave nothing
    // scheduled; the framework fails this test if a timer survives.
    await disposeModal(tester);
    await tester.pump(const Duration(seconds: 3));
  });
}
