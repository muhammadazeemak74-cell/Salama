import 'package:boloshop/core/network/api_client.dart';
import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/features/auth/presentation/screens/phone_login_screen.dart';
import 'package:boloshop/features/feed/data/feed_repository.dart';
import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:boloshop/features/feed/presentation/screens/feed_screen.dart';
import 'package:boloshop/features/orders/domain/order_models.dart';
import 'package:boloshop/features/orders/presentation/order_stats.dart';
import 'package:boloshop/features/profile/presentation/widgets/profile_drawer.dart';
import 'package:boloshop/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

StoredSession sessionAs(String role) => StoredSession(
  token: 'stored.jwt',
  userId: '22222222-2222-2222-2222-222222222222',
  phoneNumber: '+923001234567',
  role: role,
);

/// The feed without a request: a real fetch leaves Dio's timeout timer
/// pending past the end of the test.
class FakeFeedRepository implements FeedRepository {
  @override
  Future<List<FeedItem>> fetchFeed({int limit = 20}) async => sampleFeed;
}

PlacedOrder orderWorth(String totalAmountPkr) =>
    PlacedOrder.fromJson(<String, dynamic>{
      'order': {
        'id': '3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff',
        'total_amount_pkr': totalAmountPkr,
        'commission_fee_pkr': '35.00',
        'status': 'pending',
        'payment_method': 'cod',
      },
      'seller': {'store_name': 'Lahore Lawn House'},
      'whatsapp_confirmation_url': 'https://wa.me/923004440000',
    });

/// Boots the app signed in and opens the drawer from the feed's top bar.
///
/// Fixed pump durations throughout: the live badge and the Bolo button animate
/// forever, so pumpAndSettle would time out rather than fail honestly.
Future<ProviderContainer> openDrawer(
  WidgetTester tester, {
  required TokenStore store,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(store),
        feedRepositoryProvider.overrideWithValue(FakeFeedRepository()),
      ],
      child: const BoloShopApp(),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  expect(find.byType(FeedScreen), findsOneWidget);

  final container = ProviderScope.containerOf(
    tester.element(find.byType(FeedScreen)),
  );

  await tester.tap(find.byIcon(Icons.person_outline_rounded));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));

  return container;
}

/// Scopes a finder to the drawer. The feed is still mounted behind it, and it
/// shows prices of its own — `₨ 3,500` is the sample lawn suit as well as a
/// plausible order total.
Finder inDrawer(Finder finder) =>
    find.descendant(of: find.byType(ProfileDrawer), matching: finder);

void main() {

  group('roleLabel', () {
    test('title-cases the roles the gateway issues', () {
      expect(ProfileDrawer.roleLabel('buyer'), 'Buyer');
      expect(ProfileDrawer.roleLabel('seller'), 'Seller');
      expect(ProfileDrawer.roleLabel('admin'), 'Admin');
    });

    test('reads an unknown or missing role as Buyer', () {
      // An account with no explicit role is a buyer, and a drawer with a blank
      // where the role goes looks broken.
      expect(ProfileDrawer.roleLabel(null), 'Buyer');
      expect(ProfileDrawer.roleLabel('wholesaler'), 'Buyer');
    });
  });

  testWidgets('shows the signed-in number and role', (tester) async {
    await openDrawer(tester, store: InMemoryTokenStore(sessionAs('seller')));

    // Grouped the way the number is spoken here, not as raw E.164.
    expect(inDrawer(find.text('+92 300 1234567')), findsOneWidget);
    expect(inDrawer(find.text('Seller')), findsOneWidget);
  });

  testWidgets('says so plainly when nothing has been ordered', (tester) async {
    await openDrawer(tester, store: InMemoryTokenStore(sessionAs('buyer')));

    expect(inDrawer(find.textContaining('Nothing ordered yet')), findsOneWidget);
  });

  testWidgets('shows orders, team buys and their COD value', (tester) async {
    final container = await openDrawer(
      tester,
      store: InMemoryTokenStore(sessionAs('buyer')),
    );

    final stats = container.read(orderStatsProvider.notifier);
    stats.record(orderWorth('3500.00'));
    stats.record(orderWorth('2450.00'), isTeamBuy: true);
    await tester.pump();

    expect(inDrawer(find.text('2')), findsOneWidget);
    expect(inDrawer(find.text('Orders')), findsOneWidget);
    expect(inDrawer(find.text('1')), findsOneWidget);
    expect(inDrawer(find.text('Team buys')), findsOneWidget);
    expect(inDrawer(find.text('₨ 5,950')), findsOneWidget);
  });

  testWidgets('scopes the tally to this device rather than implying history', (
    tester,
  ) async {
    await openDrawer(tester, store: InMemoryTokenStore(sessionAs('buyer')));

    expect(inDrawer(find.textContaining('Counted on this device')), findsOneWidget);
  });

  testWidgets('signing out clears storage and lands back on sign-in', (
    tester,
  ) async {
    final store = InMemoryTokenStore(sessionAs('buyer'));
    final container = await openDrawer(tester, store: store);

    expect(container.read(apiClientProvider).isAuthenticated, isTrue);

    await tester.tap(find.text('Sign out'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    // The route reset, not just the state: a feed left underneath would still
    // be holding the previous user's video controllers.
    expect(find.byType(PhoneLoginScreen), findsOneWidget);
    expect(find.byType(FeedScreen), findsNothing);

    // All three places the credential lived.
    expect(container.read(sessionProvider).status, SessionStatus.signedOut);
    expect(container.read(apiClientProvider).isAuthenticated, isFalse);
    expect(await store.read(), isNull);
  });

  testWidgets('drops the previous buyer’s order tally on sign out', (
    tester,
  ) async {
    final container = await openDrawer(
      tester,
      store: InMemoryTokenStore(sessionAs('buyer')),
    );
    container.read(orderStatsProvider.notifier).record(orderWorth('3500.00'));
    await tester.pump();
    expect(inDrawer(find.text('₨ 3,500')), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    // Phones are shared here. The next person to sign in must not open the
    // drawer onto someone else's orders.
    expect(container.read(orderStatsProvider).isEmpty, isTrue);
  });
}
