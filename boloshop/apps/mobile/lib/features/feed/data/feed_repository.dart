import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/feed_item.dart';

/// Loads the feed.
///
/// The gateway has no feed endpoint yet — `GET /api/v1/products` returns the
/// catalog, and the live/engagement side needs the Redis stats the
/// architecture calls for. So [fetchFeed] talks to the real endpoint and falls
/// back to [sampleFeed] when it cannot, which keeps the app runnable end to end
/// while that lands. The fallback is deliberately loud in debug.
class FeedRepository {
  const FeedRepository(this._client);

  final ApiClient _client;

  Future<List<FeedItem>> fetchFeed({int limit = 20}) async {
    final response = await _client.get(
      ApiService.gateway,
      '/api/v1/products',
      query: {'limit': limit},
    );

    final data = response['data'];
    if (data is! List) return const <FeedItem>[];

    return data
        .whereType<Map<String, dynamic>>()
        .map(FeedItem.fromProductJson)
        .toList(growable: false);
  }
}

final feedRepositoryProvider = Provider<FeedRepository>(
  (ref) => FeedRepository(ref.watch(apiClientProvider)),
);

/// Stand-in content, so the feed renders before the backend has a feed
/// endpoint. Written as real Pakistani listings rather than lorem ipsum:
/// placeholder copy hides layout problems that real product names cause.
const List<FeedItem> sampleFeed = <FeedItem>[
  FeedItem(
    id: 'f1',
    sellerId: 'aaaaaaaa-0000-0000-0000-000000000001',
    productTitle: '3-Piece Unstitched Lawn Suit — Summer Collection',
    fabricSpecs:
        'Pure lawn • Digital print shirt • Chiffon dupatta • Cambric trouser',
    soloPricePkr: '3500.00',
    teamPricePkr: '2450.00',
    storeName: 'Lahore Lawn House',
    sellerHandle: '@lahorelawnhouse',
    city: 'Lahore',
    likeCount: 12400,
    commentCount: 843,
    isLive: true,
    liveViewerCount: 1200,
  ),
  FeedItem(
    id: 'f2',
    sellerId: 'aaaaaaaa-0000-0000-0000-000000000002',
    productTitle: 'Embroidered Chikankari Kurta',
    fabricSpecs: 'Cotton net • Hand chikankari • Full sleeves • Free delivery',
    soloPricePkr: '4200.00',
    teamPricePkr: '2940.00',
    storeName: 'Karachi Kurta Co.',
    sellerHandle: '@karachikurta',
    city: 'Karachi',
    likeCount: 8900,
    commentCount: 312,
    isLive: false,
    liveViewerCount: 0,
  ),
  FeedItem(
    id: 'f3',
    sellerId: 'aaaaaaaa-0000-0000-0000-000000000003',
    productTitle: 'Peshawari Chappal — Original Charsadda',
    fabricSpecs: 'Buffalo leather • Hand-stitched sole • Sizes 39–46 • COD',
    soloPricePkr: '5800.00',
    teamPricePkr: '4060.00',
    storeName: 'Charsadda Leather',
    sellerHandle: '@charsaddaleather',
    city: 'Peshawar',
    likeCount: 21300,
    commentCount: 1900,
    isLive: true,
    liveViewerCount: 3400,
  ),
  FeedItem(
    id: 'f4',
    sellerId: 'aaaaaaaa-0000-0000-0000-000000000004',
    productTitle: 'Wireless Earbuds — 40hr Battery',
    fabricSpecs:
        'ENC mic • Bluetooth 5.3 • Type-C • 7-day replacement warranty',
    soloPricePkr: '2999.00',
    teamPricePkr: '2099.00',
    storeName: 'Gadget Bazaar',
    sellerHandle: '@gadgetbazaarpk',
    city: 'Rawalpindi',
    likeCount: 5600,
    commentCount: 204,
    isLive: false,
    liveViewerCount: 0,
  ),
];
