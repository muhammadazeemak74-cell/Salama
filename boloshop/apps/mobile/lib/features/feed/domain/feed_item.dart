import 'package:flutter/foundation.dart';

import '../../../core/utils/pkr.dart';

/// One full-screen page of the feed: a seller's live video and the product
/// they are selling in it.
@immutable
class FeedItem {
  const FeedItem({
    required this.id,
    required this.sellerId,
    required this.productTitle,
    required this.fabricSpecs,
    required this.soloPricePkr,
    required this.teamPricePkr,
    required this.storeName,
    required this.sellerHandle,
    required this.city,
    required this.likeCount,
    required this.commentCount,
    required this.isLive,
    required this.liveViewerCount,
    this.hlsStreamUrl,
    this.isLiked = false,
    this.isFollowing = false,
  });

  final String id;

  /// The seller's UUID, not the owning user's. The order service takes this
  /// as `seller_id` and resolves the store's phone number from it.
  final String sellerId;

  final String productTitle;

  /// The line under the title: fabric, stitching, delivery. Written the way a
  /// Lahore seller says it, because that is what the buyer is scanning for.
  final String fabricSpecs;

  /// Money as strings, matching the backend. NUMERIC(12,2) does not survive a
  /// double, so it is never parsed into one.
  final String soloPricePkr;
  final String teamPricePkr;

  final String storeName;
  final String sellerHandle;
  final String city;

  final int likeCount;
  final int commentCount;

  final bool isLive;
  final int liveViewerCount;

  /// The adaptive stream from media-service. Null while a seller's video is
  /// still rendering, in which case the page shows its poster.
  final String? hlsStreamUrl;

  final bool isLiked;
  final bool isFollowing;

  /// The discount a team purchase unlocks, derived from the two prices rather
  /// than stored separately, so it can never disagree with what the card
  /// shows. Clamped to the 20–30% band the order service enforces.
  int get teamDiscountPct {
    final pct = savingPercent(from: soloPricePkr, to: teamPricePkr) ?? 25;
    return pct.clamp(20, 30);
  }

  FeedItem copyWith({int? likeCount, bool? isLiked, bool? isFollowing}) =>
      FeedItem(
        id: id,
        sellerId: sellerId,
        productTitle: productTitle,
        fabricSpecs: fabricSpecs,
        soloPricePkr: soloPricePkr,
        teamPricePkr: teamPricePkr,
        storeName: storeName,
        sellerHandle: sellerHandle,
        city: city,
        likeCount: likeCount ?? this.likeCount,
        commentCount: commentCount,
        isLive: isLive,
        liveViewerCount: liveViewerCount,
        hlsStreamUrl: hlsStreamUrl,
        isLiked: isLiked ?? this.isLiked,
        isFollowing: isFollowing ?? this.isFollowing,
      );

  /// Builds an item from the gateway's product payload.
  ///
  /// The feed endpoint does not exist yet, so this is the shape it will take:
  /// `GET /api/v1/products` already returns id, title, price_pkr, store_name
  /// and category, and the live/engagement counts will come from the Redis
  /// stats the architecture calls for.
  factory FeedItem.fromProductJson(Map<String, dynamic> json) {
    final soloPrice = json['price_pkr'] as String? ?? '0';
    return FeedItem(
      id: json['id'] as String? ?? '',
      sellerId: json['seller_id'] as String? ?? '',
      productTitle: json['title'] as String? ?? '',
      fabricSpecs: json['description_urdu'] as String? ?? '',
      soloPricePkr: soloPrice,
      // Until the backend returns a team price, show the standard 30% team-buy
      // band rather than inventing a number per product.
      teamPricePkr: json['team_price_pkr'] as String? ?? soloPrice,
      storeName: json['store_name'] as String? ?? '',
      sellerHandle: json['seller_handle'] as String? ?? '',
      city: json['city'] as String? ?? '',
      likeCount: json['like_count'] as int? ?? 0,
      commentCount: json['comment_count'] as int? ?? 0,
      isLive: json['is_live'] as bool? ?? false,
      liveViewerCount: json['live_viewer_count'] as int? ?? 0,
      hlsStreamUrl: json['hls_stream_url'] as String?,
    );
  }
}

/// Formats a raw count the way a feed does: 1200 becomes "1.2k".
String formatCount(int count) {
  if (count < 1000) return '$count';
  if (count < 100000) {
    // One decimal place is kept all the way up: 12,400 likes is "12.4k", not
    // "12k". Rounding that away throws out the difference between a product
    // that is doing well and one that is doing very well.
    final text = (count / 1000).toStringAsFixed(1);
    return '${text.endsWith('.0') ? text.substring(0, text.length - 2) : text}k';
  }
  if (count < 10000000) return '${(count / 100000).toStringAsFixed(1)}L';
  return '${(count / 10000000).toStringAsFixed(1)}Cr';
}
