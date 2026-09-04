import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session.dart';
import '../../../core/utils/pkr.dart';
import '../domain/order_models.dart';

/// What this device has ordered since sign-in.
///
/// The order service has no "list my orders" endpoint yet — `POST
/// /api/v1/orders`, `GET /api/v1/orders/{id}`, the tracking update and the
/// team-buy pair are all of it — so this is a tally of what the app itself
/// placed, not the buyer's history. The drawer says so rather than passing it
/// off as a complete record. When the endpoint lands, this is replaced by it.
@immutable
class OrderStats {
  const OrderStats({
    this.ordersPlaced = 0,
    this.teamBuysOpened = 0,
    this.totalPaisa = 0,
  });

  /// Every order placed, solo and team alike — a team buy creates an order
  /// too, so counting it separately would double it.
  final int ordersPlaced;
  final int teamBuysOpened;

  /// Integer paisa, for the reason money is a string everywhere else: adding
  /// rupees up as doubles loses them.
  final int totalPaisa;

  bool get isEmpty => ordersPlaced == 0;

  /// The tally in the decimal-string shape the backend uses, so it formats
  /// through [formatPkr] like any server-sent amount.
  String get totalAmountPkr => paisaToAmount(totalPaisa);

  OrderStats _plus({required int paisa, required bool isTeamBuy}) => OrderStats(
    ordersPlaced: ordersPlaced + 1,
    teamBuysOpened: teamBuysOpened + (isTeamBuy ? 1 : 0),
    totalPaisa: totalPaisa + paisa,
  );
}

/// Counts orders as they are placed.
class OrderStatsController extends Notifier<OrderStats> {
  @override
  OrderStats build() {
    // The tally belongs to whoever is signed in. Watching the buyer id means a
    // sign-out — or a different number signing in on a shared phone, which is
    // normal here — starts a fresh one instead of showing someone else's
    // orders in the drawer.
    ref.watch(sessionProvider.select((session) => session.buyerId));
    return const OrderStats();
  }

  /// Records an order the service confirmed. Call it only on success: a
  /// failed request placed nothing.
  void record(PlacedOrder order, {bool isTeamBuy = false}) {
    // An unparseable total still counts as an order; it just adds nothing to
    // the value. Dropping the whole record over a malformed amount would be
    // the worse trade.
    state = state._plus(
      paisa: pkrToPaisa(order.totalAmountPkr) ?? 0,
      isTeamBuy: isTeamBuy,
    );
  }
}

final orderStatsProvider = NotifierProvider<OrderStatsController, OrderStats>(
  OrderStatsController.new,
);
