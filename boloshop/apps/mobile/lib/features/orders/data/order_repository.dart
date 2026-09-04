import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/order_models.dart';

/// Calls the Go order service.
///
/// Both endpoints are on [ApiService.orders], wherever the build's [EnvConfig]
/// puts that — localhost:4002 in development, a real hostname otherwise.
class OrderRepository {
  const OrderRepository(this._client);

  final ApiClient _client;

  /// `POST /api/v1/orders`
  ///
  /// The commission is deliberately not sent: `commission_fee_pkr` is a
  /// generated column in Postgres, and the service rejects a body that tries
  /// to set it. The 1% comes back in the response, computed server-side.
  Future<PlacedOrder> createOrder({
    required String buyerId,
    required String sellerId,
    required String totalAmountPkr,
  }) async {
    final response = await _client.post(
      ApiService.orders,
      '/api/v1/orders',
      body: {
        'buyer_id': buyerId,
        'seller_id': sellerId,
        'total_amount_pkr': totalAmountPkr,
      },
    );
    return PlacedOrder.fromJson(response);
  }

  /// `POST /api/v1/team-buy/create`
  ///
  /// A team purchase is opened on an order that already exists and is still
  /// pending, by the buyer who placed it — so [createOrder] has to run first.
  /// The service holds the discount to a 20–30% band.
  Future<TeamPurchase> createTeamPurchase({
    required String orderId,
    required String inviterId,
    int? discountPct,
  }) async {
    final response = await _client.post(
      ApiService.orders,
      '/api/v1/team-buy/create',
      body: {
        'order_id': orderId,
        'inviter_id': inviterId,
        'discount_pct': ?discountPct,
      },
    );
    return TeamPurchase.fromJson(response);
  }
}

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepository(ref.watch(apiClientProvider)),
);
