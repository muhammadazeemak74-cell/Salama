import 'package:boloshop/core/launcher/url_launcher_service.dart';
import 'package:boloshop/core/network/api_client.dart';
import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:boloshop/features/orders/data/order_repository.dart';
import 'package:boloshop/features/orders/domain/order_models.dart';
import 'package:boloshop/features/orders/presentation/order_actions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records what was launched instead of touching a platform channel.
class FakeLauncher implements UrlLauncherService {
  FakeLauncher({this.succeeds = true});

  final bool succeeds;
  final List<Uri> launched = [];

  @override
  Future<bool> launch(Uri url) async {
    launched.add(url);
    return succeeds;
  }
}

/// Records the request bodies so the wire format can be asserted.
class FakeOrderRepository implements OrderRepository {
  FakeOrderRepository({this.orderError, this.teamError});

  final Object? orderError;
  final Object? teamError;

  final List<Map<String, String>> orderCalls = [];
  final List<Map<String, Object?>> teamCalls = [];

  @override
  Future<PlacedOrder> createOrder({
    required String buyerId,
    required String sellerId,
    required String totalAmountPkr,
  }) async {
    orderCalls.add({
      'buyer_id': buyerId,
      'seller_id': sellerId,
      'total_amount_pkr': totalAmountPkr,
    });
    if (orderError != null) throw orderError!;

    return PlacedOrder.fromJson(const {
      'order': {
        'id': '3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff',
        'total_amount_pkr': '3500.00',
        'commission_fee_pkr': '35.00',
        'status': 'pending',
        'payment_method': 'cod',
      },
      'commission_rate_pct': '1.00',
      'seller': {
        'id': 'aaaaaaaa-0000-0000-0000-000000000001',
        'store_name': 'Lahore Lawn House',
        'phone_number': '+923004440000',
      },
      'whatsapp_confirmation_url':
          'https://wa.me/923004440000?text=Assalam-o-Alaikum',
    });
  }

  @override
  Future<TeamPurchase> createTeamPurchase({
    required String orderId,
    required String inviterId,
    int? discountPct,
  }) async {
    teamCalls.add({
      'order_id': orderId,
      'inviter_id': inviterId,
      'discount_pct': discountPct,
    });
    if (teamError != null) throw teamError!;

    return TeamPurchase.fromJson(const {
      'team_purchase': {
        'id': '948bb85c-2dad-481c-80a9-2ef6ef2ec2e9',
        'order_id': '3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff',
        'status': 'pending_join',
        'discount_applied_pct': '30.00',
        'expires_at': '2026-08-31T23:51:36.768648Z',
        'seconds_remaining': 86400,
      },
      'share_url':
          'https://boloshop.pk/team/948bb85c-2dad-481c-80a9-2ef6ef2ec2e9',
      'window_hours': 24,
    });
  }
}

const testItem = FeedItem(
  id: 'f1',
  sellerId: 'aaaaaaaa-0000-0000-0000-000000000001',
  productTitle: '3-Piece Unstitched Lawn Suit',
  fabricSpecs: 'Pure lawn',
  soloPricePkr: '3500.00',
  teamPricePkr: '2450.00',
  storeName: 'Lahore Lawn House',
  sellerHandle: '@lahorelawnhouse',
  city: 'Lahore',
  likeCount: 0,
  commentCount: 0,
  isLive: true,
  liveViewerCount: 1200,
);

ProviderContainer makeContainer({
  required FakeOrderRepository repository,
  required FakeLauncher launcher,
  String? buyerId = '22222222-2222-2222-2222-222222222222',
}) {
  final container = ProviderContainer(
    overrides: [
      orderRepositoryProvider.overrideWithValue(repository),
      urlLauncherProvider.overrideWithValue(launcher),
      sessionProvider.overrideWith(() => _FixedSession(buyerId)),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

class _FixedSession extends SessionController {
  _FixedSession(this._buyerId);
  final String? _buyerId;

  @override
  Session build() => Session(buyerId: _buyerId);
}

void main() {
  group('solo buy', () {
    test(
      'creates the order at the solo price and opens the wa.me link',
      () async {
        final repository = FakeOrderRepository();
        final launcher = FakeLauncher();
        final container = makeContainer(
          repository: repository,
          launcher: launcher,
        );

        final outcome = await container
            .read(orderActionsProvider.notifier)
            .soloBuy(testItem);

        expect(outcome, isA<SoloBuyPlaced>());
        final placed = outcome as SoloBuyPlaced;
        expect(placed.whatsAppOpened, isTrue);
        expect(placed.order.shortId, '3AFF3BF4');
        // The 1% comes back from the service; the app never computes it.
        expect(placed.order.commissionFeePkr, '35.00');

        // Charged the solo price, not the team price — the discount only lands
        // when a friend joins.
        expect(repository.orderCalls.single['total_amount_pkr'], '3500.00');
        expect(
          repository.orderCalls.single['seller_id'],
          'aaaaaaaa-0000-0000-0000-000000000001',
        );

        expect(launcher.launched.single.host, 'wa.me');
        expect(launcher.launched.single.path, '/923004440000');
      },
    );

    test('never sends a commission field', () async {
      final repository = FakeOrderRepository();
      final container = makeContainer(
        repository: repository,
        launcher: FakeLauncher(),
      );

      await container.read(orderActionsProvider.notifier).soloBuy(testItem);

      expect(
        repository.orderCalls.single.containsKey('commission_fee_pkr'),
        isFalse,
      );
    });

    test('reports the order as placed even when WhatsApp will not open', () async {
      final launcher = FakeLauncher(succeeds: false);
      final container = makeContainer(
        repository: FakeOrderRepository(),
        launcher: launcher,
      );

      final outcome = await container
          .read(orderActionsProvider.notifier)
          .soloBuy(testItem);

      // The order exists; only the hand-off failed. Saying "failed" here would
      // leave a buyer with a COD order they do not know about.
      expect(outcome, isA<SoloBuyPlaced>());
      expect((outcome as SoloBuyPlaced).whatsAppOpened, isFalse);
    });

    test('asks for sign-in instead of inventing a buyer', () async {
      final repository = FakeOrderRepository();
      final container = makeContainer(
        repository: repository,
        launcher: FakeLauncher(),
        buyerId: null,
      );

      final outcome = await container
          .read(orderActionsProvider.notifier)
          .soloBuy(testItem);

      expect(outcome, isA<BuyNeedsSignIn>());
      expect(repository.orderCalls, isEmpty);
    });

    test('surfaces the service error message', () async {
      final container = makeContainer(
        repository: FakeOrderRepository(
          orderError: const ApiException(
            message: "The buyer's phone number is not verified yet.",
            code: 'forbidden',
            statusCode: 403,
          ),
        ),
        launcher: FakeLauncher(),
      );

      final outcome = await container
          .read(orderActionsProvider.notifier)
          .soloBuy(testItem);

      expect(outcome, isA<BuyFailed>());
      expect(
        (outcome as BuyFailed).message,
        "The buyer's phone number is not verified yet.",
      );
    });

    test(
      'refuses an item with no seller rather than posting an empty id',
      () async {
        final repository = FakeOrderRepository();
        final container = makeContainer(
          repository: repository,
          launcher: FakeLauncher(),
        );

        const orphan = FeedItem(
          id: 'x',
          sellerId: '',
          productTitle: 'No seller',
          fabricSpecs: '',
          soloPricePkr: '100.00',
          teamPricePkr: '80.00',
          storeName: '',
          sellerHandle: '',
          city: '',
          likeCount: 0,
          commentCount: 0,
          isLive: false,
          liveViewerCount: 0,
        );

        expect(
          await container.read(orderActionsProvider.notifier).soloBuy(orphan),
          isA<BuyFailed>(),
        );
        expect(repository.orderCalls, isEmpty);
      },
    );
  });

  group('team buy', () {
    test('creates the order first, then the team purchase on it', () async {
      final repository = FakeOrderRepository();
      final container = makeContainer(
        repository: repository,
        launcher: FakeLauncher(),
      );

      final outcome = await container
          .read(orderActionsProvider.notifier)
          .teamBuy(testItem);

      expect(outcome, isA<TeamBuyOpened>());
      final opened = outcome as TeamBuyOpened;
      expect(opened.teamPurchase.shareUrl, contains('boloshop.pk/team/'));
      expect(opened.teamPurchase.discountPctRounded, 30);
      expect(opened.teamPurchase.windowHours, 24);

      // The order service opens a team purchase on an existing pending order,
      // so the order id has to come from the first call.
      expect(repository.orderCalls, hasLength(1));
      expect(
        repository.teamCalls.single['order_id'],
        '3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff',
      );
      // 3500 -> 2450 is 30%, inside the service's 20-30 band.
      expect(repository.teamCalls.single['discount_pct'], 30);
    });

    test(
      'does not open WhatsApp until the invite is actually shared',
      () async {
        final launcher = FakeLauncher();
        final container = makeContainer(
          repository: FakeOrderRepository(),
          launcher: launcher,
        );

        final outcome = await container
            .read(orderActionsProvider.notifier)
            .teamBuy(testItem);
        expect(launcher.launched, isEmpty);

        await container
            .read(orderActionsProvider.notifier)
            .shareTeamInvite(
              teamPurchase: (outcome as TeamBuyOpened).teamPurchase,
              item: testItem,
            );

        final uri = launcher.launched.single;
        // No number in the path: this opens the contact picker, because the
        // friend being invited is whoever the buyer chooses.
        expect(uri.host, 'wa.me');
        expect(uri.path, '/');

        final text = uri.queryParameters['text']!;
        expect(
          text,
          contains('Join my group purchase on BoloShop to get 30% off!'),
        );
        expect(text, contains('3-Piece Unstitched Lawn Suit'));
        expect(text, contains('boloshop.pk/team/'));
      },
    );

    test('surfaces a team-purchase failure without losing the order', () async {
      final repository = FakeOrderRepository(
        teamError: const ApiException(
          message: 'This order already has a team purchase.',
          code: 'team_purchase_exists',
          statusCode: 409,
        ),
      );
      final container = makeContainer(
        repository: repository,
        launcher: FakeLauncher(),
      );

      final outcome = await container
          .read(orderActionsProvider.notifier)
          .teamBuy(testItem);

      expect(outcome, isA<BuyFailed>());
      // The order was still created — worth knowing when reading this test
      // later, because it is a real consequence of the two-call sequence.
      expect(repository.orderCalls, hasLength(1));
    });
  });

  group('double taps', () {
    test(
      'a second buy while one is in flight does not place a second order',
      () async {
        final repository = FakeOrderRepository();
        final container = makeContainer(
          repository: repository,
          launcher: FakeLauncher(),
        );
        final actions = container.read(orderActionsProvider.notifier);

        final first = actions.soloBuy(testItem);
        final second = await actions.soloBuy(testItem);

        expect(second, isA<BuyAlreadyInProgress>());
        await first;
        expect(repository.orderCalls, hasLength(1));
      },
    );

    test('the busy flag clears after a failure', () async {
      final container = makeContainer(
        repository: FakeOrderRepository(orderError: Exception('boom')),
        launcher: FakeLauncher(),
      );

      await container.read(orderActionsProvider.notifier).soloBuy(testItem);
      expect(container.read(orderActionsProvider), isFalse);
    });
  });
}
