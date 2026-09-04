import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/features/orders/domain/order_models.dart';
import 'package:boloshop/features/orders/presentation/order_stats.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

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

ProviderContainer makeContainer({TokenStore? tokenStore}) {
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(tokenStore ?? InMemoryTokenStore()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('starts empty', () {
    final stats = makeContainer().read(orderStatsProvider);

    expect(stats.isEmpty, isTrue);
    expect(stats.ordersPlaced, 0);
    expect(stats.teamBuysOpened, 0);
    expect(stats.totalAmountPkr, '0.00');
  });

  test('counts orders and sums their value exactly', () {
    final container = makeContainer();
    final stats = container.read(orderStatsProvider.notifier);

    stats.record(orderWorth('3500.00'));
    stats.record(orderWorth('2449.50'));

    final result = container.read(orderStatsProvider);
    expect(result.ordersPlaced, 2);
    // Paisa arithmetic, not doubles: 3500.00 + 2449.50 to the paisa.
    expect(result.totalAmountPkr, '5949.50');
  });

  test('counts a team buy as an order as well as a team buy', () {
    final container = makeContainer();
    final stats = container.read(orderStatsProvider.notifier);

    stats.record(orderWorth('3500.00'), isTeamBuy: true);

    expect(container.read(orderStatsProvider).ordersPlaced, 1);
    expect(container.read(orderStatsProvider).teamBuysOpened, 1);
  });

  test('still counts an order whose total will not parse', () {
    final container = makeContainer();
    container.read(orderStatsProvider.notifier).record(orderWorth('not-money'));

    final result = container.read(orderStatsProvider);
    expect(result.ordersPlaced, 1);
    expect(result.totalPaisa, 0);
  });

  test('resets when the buyer changes, so a shared phone does not leak', () async {
    final store = InMemoryTokenStore(
      const StoredSession(
        token: 'stored.jwt',
        userId: 'u-1',
        phoneNumber: '+923001234567',
        role: 'buyer',
      ),
    );
    final container = makeContainer(tokenStore: store);
    await container.read(sessionProvider.notifier).restore();

    container.read(orderStatsProvider.notifier).record(orderWorth('3500.00'));
    expect(container.read(orderStatsProvider).ordersPlaced, 1);

    await container.read(sessionProvider.notifier).signOut();

    expect(container.read(orderStatsProvider).isEmpty, isTrue);
  });
}
