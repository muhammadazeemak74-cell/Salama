import 'package:flutter/foundation.dart';

/// An order as the Go order service returns it.
///
/// Money stays a string all the way through — it is NUMERIC(12,2) in Postgres
/// and a double cannot hold every rupee value exactly.
@immutable
class PlacedOrder {
  const PlacedOrder({
    required this.id,
    required this.totalAmountPkr,
    required this.commissionFeePkr,
    required this.status,
    required this.paymentMethod,
    required this.storeName,
    required this.sellerPhoneNumber,
    required this.whatsAppConfirmationUrl,
    required this.commissionRatePct,
  });

  final String id;
  final String totalAmountPkr;

  /// The 1% platform commission. Computed by Postgres as a generated column,
  /// never by this app — it is displayed, not calculated.
  final String commissionFeePkr;
  final String commissionRatePct;

  final String status;
  final String paymentMethod;

  final String storeName;
  final String sellerPhoneNumber;

  /// The wa.me deep link the service built, already carrying the confirmation
  /// message in the seller's own store name.
  final String whatsAppConfirmationUrl;

  /// The human-facing reference: the first group of the UUID, uppercased. The
  /// service formats it the same way in the WhatsApp message, so a buyer
  /// reading it aloud on the phone matches what the seller sees.
  String get shortId {
    final dash = id.indexOf('-');
    return (dash == -1 ? id : id.substring(0, dash)).toUpperCase();
  }

  factory PlacedOrder.fromJson(Map<String, dynamic> json) {
    final order = json['order'] as Map<String, dynamic>? ?? const {};
    final seller = json['seller'] as Map<String, dynamic>? ?? const {};

    return PlacedOrder(
      id: order['id'] as String? ?? '',
      totalAmountPkr: order['total_amount_pkr'] as String? ?? '0',
      commissionFeePkr: order['commission_fee_pkr'] as String? ?? '0',
      status: order['status'] as String? ?? 'pending',
      paymentMethod: order['payment_method'] as String? ?? 'cod',
      storeName: seller['store_name'] as String? ?? '',
      sellerPhoneNumber: seller['phone_number'] as String? ?? '',
      // The service names this field whatsapp_confirmation_url; whatsapp_url
      // is accepted too so a rename on either side does not silently produce
      // an order with no way to confirm it.
      whatsAppConfirmationUrl:
          json['whatsapp_confirmation_url'] as String? ??
          json['whatsapp_url'] as String? ??
          '',
      commissionRatePct: json['commission_rate_pct'] as String? ?? '1.00',
    );
  }
}

/// A team purchase as the order service returns it.
@immutable
class TeamPurchase {
  const TeamPurchase({
    required this.id,
    required this.orderId,
    required this.status,
    required this.discountPct,
    required this.shareUrl,
    required this.expiresAt,
    required this.secondsRemaining,
    required this.windowHours,
  });

  final String id;
  final String orderId;
  final String status;
  final String discountPct;

  /// The link to send to a friend.
  final String shareUrl;

  /// Derived by the service from created_at plus the join window, against the
  /// database's clock rather than this phone's.
  final DateTime? expiresAt;
  final int secondsRemaining;
  final int windowHours;

  /// Whole-number discount for display: "25.00" becomes 25.
  int get discountPctRounded => double.tryParse(discountPct)?.round() ?? 0;

  factory TeamPurchase.fromJson(Map<String, dynamic> json) {
    final tp = json['team_purchase'] as Map<String, dynamic>? ?? const {};
    final expiresRaw = tp['expires_at'] as String?;

    return TeamPurchase(
      id: tp['id'] as String? ?? '',
      orderId: tp['order_id'] as String? ?? '',
      status: tp['status'] as String? ?? 'pending_join',
      discountPct: tp['discount_applied_pct'] as String? ?? '0',
      shareUrl: json['share_url'] as String? ?? '',
      expiresAt: expiresRaw == null ? null : DateTime.tryParse(expiresRaw),
      secondsRemaining: tp['seconds_remaining'] as int? ?? 0,
      windowHours: json['window_hours'] as int? ?? 24,
    );
  }
}
