import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/launcher/url_launcher_service.dart';
import '../../../core/network/api_client.dart';
import '../../../core/session/session.dart';
import '../../feed/domain/feed_item.dart';
import '../data/order_repository.dart';
import '../domain/order_models.dart';
import '../domain/whatsapp_message.dart';
import 'order_stats.dart';

/// What a buy attempt produced. Sealed so the screen has to handle every case
/// — an unhandled failure on a checkout button is the worst kind of silence.
sealed class BuyOutcome {
  const BuyOutcome();
}

/// No buyer identity. The OTP flow that would provide one is not built yet.
class BuyNeedsSignIn extends BuyOutcome {
  const BuyNeedsSignIn();
}

/// The order exists. [whatsAppOpened] is false when the device had nothing to
/// handle the link — usually WhatsApp not being installed — which is worth
/// saying out loud, because the order was still placed.
class SoloBuyPlaced extends BuyOutcome {
  const SoloBuyPlaced({required this.order, required this.whatsAppOpened});

  final PlacedOrder order;
  final bool whatsAppOpened;
}

/// The order and the team purchase both exist; the screen shows the share
/// dialog next.
class TeamBuyOpened extends BuyOutcome {
  const TeamBuyOpened({required this.order, required this.teamPurchase});

  final PlacedOrder order;
  final TeamPurchase teamPurchase;
}

/// Something went wrong, with a message already safe to show a person.
class BuyFailed extends BuyOutcome {
  const BuyFailed(this.message, {this.isConnectivityFailure = false});

  final String message;
  final bool isConnectivityFailure;
}

/// A buy is already in flight. Returned instead of firing a second order.
class BuyAlreadyInProgress extends BuyOutcome {
  const BuyAlreadyInProgress();
}

/// Drives the two purchase paths.
///
/// Both start with the same call — an order has to exist before a team
/// purchase can be opened on it — so the difference between the buttons is
/// what happens after `POST /api/v1/orders` returns.
class OrderActions extends Notifier<bool> {
  /// State is "is a buy in flight". Double-tapping a CTA on a slow connection
  /// must not place two cash-on-delivery orders.
  @override
  bool build() => false;

  Future<BuyOutcome> soloBuy(FeedItem item) async {
    if (state) return const BuyAlreadyInProgress();

    final session = ref.read(sessionProvider);
    if (!session.isAuthenticated) return const BuyNeedsSignIn();

    if (item.sellerId.isEmpty) {
      return const BuyFailed(
        'This product is missing its seller, so it cannot be ordered.',
      );
    }

    state = true;
    try {
      final order = await ref
          .read(orderRepositoryProvider)
          .createOrder(
            buyerId: session.buyerId!,
            sellerId: item.sellerId,
            // Solo price: the team price is only unlocked when someone joins.
            totalAmountPkr: item.soloPricePkr,
          );

      ref.read(orderStatsProvider.notifier).record(order);

      final link = parseWhatsAppUrl(order.whatsAppConfirmationUrl);
      final opened = link == null
          ? false
          : await ref.read(urlLauncherProvider).launch(link);

      return SoloBuyPlaced(order: order, whatsAppOpened: opened);
    } on ApiException catch (error) {
      return BuyFailed(
        error.message,
        isConnectivityFailure: error.isConnectivityFailure,
      );
    } on Object {
      return const BuyFailed('Could not place the order. Please try again.');
    } finally {
      state = false;
    }
  }

  Future<BuyOutcome> teamBuy(FeedItem item) async {
    if (state) return const BuyAlreadyInProgress();

    final session = ref.read(sessionProvider);
    if (!session.isAuthenticated) return const BuyNeedsSignIn();

    if (item.sellerId.isEmpty) {
      return const BuyFailed(
        'This product is missing its seller, so it cannot be ordered.',
      );
    }

    state = true;
    try {
      final repository = ref.read(orderRepositoryProvider);

      // The order is created at the solo price. The discount is applied by the
      // order service when a friend actually joins, which also recomputes the
      // commission — so the app never writes a discounted total itself.
      final order = await repository.createOrder(
        buyerId: session.buyerId!,
        sellerId: item.sellerId,
        totalAmountPkr: item.soloPricePkr,
      );

      ref.read(orderStatsProvider.notifier).record(order, isTeamBuy: true);

      final teamPurchase = await repository.createTeamPurchase(
        orderId: order.id,
        inviterId: session.buyerId!,
        discountPct: item.teamDiscountPct,
      );

      return TeamBuyOpened(order: order, teamPurchase: teamPurchase);
    } on ApiException catch (error) {
      return BuyFailed(
        error.message,
        isConnectivityFailure: error.isConnectivityFailure,
      );
    } on Object {
      return const BuyFailed(
        'Could not start the team purchase. Please try again.',
      );
    } finally {
      state = false;
    }
  }

  /// Opens WhatsApp's contact picker with the invitation ready to send.
  Future<bool> shareTeamInvite({
    required TeamPurchase teamPurchase,
    required FeedItem item,
  }) {
    final link = teamInviteLink(
      shareUrl: teamPurchase.shareUrl,
      productTitle: item.productTitle,
      discountPct: teamPurchase.discountPctRounded,
      storeName: item.storeName,
    );
    return ref.read(urlLauncherProvider).launch(link);
  }
}

final orderActionsProvider = NotifierProvider<OrderActions, bool>(
  OrderActions.new,
);
