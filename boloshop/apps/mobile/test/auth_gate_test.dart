import 'dart:async';

import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/features/auth/data/auth_repository.dart';
import 'package:boloshop/features/auth/domain/auth_models.dart';
import 'package:boloshop/features/auth/presentation/screens/phone_login_screen.dart';
import 'package:boloshop/features/feed/data/feed_repository.dart';
import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:boloshop/features/feed/presentation/screens/feed_screen.dart';
import 'package:boloshop/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const storedSession = StoredSession(
  token: 'stored.jwt',
  userId: '22222222-2222-2222-2222-222222222222',
  phoneNumber: '+923001234567',
  role: 'buyer',
);

/// A store whose read never finishes, so the restoring frame can be asserted
/// rather than raced against.
class PendingTokenStore implements TokenStore {
  final Completer<StoredSession?> pending = Completer<StoredSession?>();

  @override
  Future<StoredSession?> read() => pending.future;

  @override
  Future<void> write(StoredSession session) async {}

  @override
  Future<void> clear() async {}
}

/// Serves the sample feed without a request. The gate is about which screen
/// opens, and a real fetch would leave Dio's timeout timer pending past the
/// end of the test.
class FakeFeedRepository implements FeedRepository {
  @override
  Future<List<FeedItem>> fetchFeed({int limit = 20}) async => sampleFeed;
}

/// Answers the OTP calls from memory, so the sign-in journey can be walked
/// without a gateway.
class FakeAuthRepository implements AuthRepository {
  @override
  Future<OtpChallenge> requestOtp(String phoneNumber) async =>
      OtpChallenge.fromJson(const {
        'phone_number': '+923001234567',
        'resend_after_seconds': 60,
      });

  @override
  Future<AuthResult> verifyOtp({
    required String phoneNumber,
    required String code,
    String? languagePreference,
  }) async => AuthResult.fromJson(const {
    'token': 'jwt.token.value',
    'expires_in': 2592000,
    'user': {
      'id': '22222222-2222-2222-2222-222222222222',
      'phone_number': '+923001234567',
      'role': 'buyer',
      'language_preference': 'urdu',
      'is_verified': true,
    },
  });
}

/// Boots the real app. The feed animates forever, so every pump here is a
/// fixed duration — pumpAndSettle would time out rather than fail honestly.
Future<void> pumpApp(WidgetTester tester, {required TokenStore store}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(store),
        feedRepositoryProvider.overrideWithValue(FakeFeedRepository()),
        authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
      ],
      child: const BoloShopApp(),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {

  testWidgets('opens the feed when a token survived the last run', (
    tester,
  ) async {
    await pumpApp(tester, store: InMemoryTokenStore(storedSession));

    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.byType(PhoneLoginScreen), findsNothing);
  });

  testWidgets('opens sign-in when there is no token', (tester) async {
    await pumpApp(tester, store: InMemoryTokenStore());

    expect(find.byType(PhoneLoginScreen), findsOneWidget);
    expect(find.byType(FeedScreen), findsNothing);
  });

  testWidgets('holds a splash while secure storage is being read', (
    tester,
  ) async {
    final store = PendingTokenStore();
    await pumpApp(tester, store: store);

    // Neither screen yet: showing the login screen for the frames a Keychain
    // read takes would bounce someone who is in fact signed in.
    expect(find.byType(PhoneLoginScreen), findsNothing);
    expect(find.byType(FeedScreen), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    store.pending.complete(storedSession);
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(FeedScreen), findsOneWidget);
  });

  testWidgets('signing in from a cold start ends on the feed', (tester) async {
    // The whole journey through the gate: no token, sign in, and the root
    // route the OTP screen resets to is the gate again — which by then reads a
    // signed-in session and renders the feed rather than the login screen it
    // rendered a moment ago.
    final store = InMemoryTokenStore();
    await pumpApp(tester, store: store);
    expect(find.byType(PhoneLoginScreen), findsOneWidget);

    await tester.enterText(find.byType(TextField), '3001234567');
    await tester.pump();
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettleFrames();

    await tester.enterText(find.byType(TextField), '123456');
    await tester.pump();
    await tester.pumpAndSettleFrames(30);

    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.byType(PhoneLoginScreen), findsNothing);
    // Persisted, or the next cold start would send them back to the login
    // screen with no explanation.
    expect((await store.read())?.token, 'jwt.token.value');
  });

  testWidgets('treats an unreadable store as signed out, not as a crash', (
    tester,
  ) async {
    final store = PendingTokenStore();
    await pumpApp(tester, store: store);

    store.pending.completeError(Exception('keychain unavailable'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(PhoneLoginScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

/// The feed and the auth screens both run repeating animations, so
/// [WidgetTester.pumpAndSettle] never settles. This pumps a bounded number of
/// frames instead, which is enough for a route transition to finish.
extension on WidgetTester {
  Future<void> pumpAndSettleFrames([int frames = 12]) async {
    for (var i = 0; i < frames; i++) {
      await pump(const Duration(milliseconds: 60));
    }
  }
}
