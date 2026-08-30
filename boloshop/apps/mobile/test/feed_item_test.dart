import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatCount', () {
    test('leaves small numbers alone', () {
      expect(formatCount(0), '0');
      expect(formatCount(999), '999');
    });

    test('abbreviates thousands the way a feed does', () {
      expect(formatCount(1200), '1.2k');
      expect(formatCount(1000), '1k');
      expect(formatCount(12400), '12.4k');
      expect(formatCount(12000), '12k');
      expect(formatCount(99999), '100k');
    });

    test('uses lakh and crore above that, as this market reads them', () {
      expect(formatCount(100000), '1.0L');
      expect(formatCount(2500000), '25.0L');
      expect(formatCount(10000000), '1.0Cr');
    });
  });

  group('FeedItem.fromProductJson', () {
    test('maps the gateway product shape', () {
      final item = FeedItem.fromProductJson(const {
        'id': 'p1',
        'title': '3-Piece Lawn Suit',
        'description_urdu': 'تین پیس لان سوٹ',
        'price_pkr': '4499.50',
        'store_name': 'Lahore Lawn House',
      });

      expect(item.id, 'p1');
      expect(item.productTitle, '3-Piece Lawn Suit');
      expect(item.fabricSpecs, 'تین پیس لان سوٹ');
      expect(item.soloPricePkr, '4499.50');
      expect(item.storeName, 'Lahore Lawn House');
      // No team price from the backend yet, so it falls back to solo rather
      // than inventing a discount.
      expect(item.teamPricePkr, '4499.50');
    });

    test('survives a payload missing every optional field', () {
      final item = FeedItem.fromProductJson(const <String, dynamic>{});
      expect(item.id, '');
      expect(item.likeCount, 0);
      expect(item.isLive, isFalse);
      expect(item.hlsStreamUrl, isNull);
    });
  });

  group('copyWith', () {
    test('changes only what it is given', () {
      const item = FeedItem(
        id: 'f1',
        sellerId: 'bbbbbbbb-0000-0000-0000-000000000009',
        productTitle: 'Kurta',
        fabricSpecs: 'Cotton',
        soloPricePkr: '1000.00',
        teamPricePkr: '800.00',
        storeName: 'Store',
        sellerHandle: '@store',
        city: 'Lahore',
        likeCount: 10,
        commentCount: 2,
        isLive: true,
        liveViewerCount: 5,
      );

      final liked = item.copyWith(isLiked: true, likeCount: 11);
      expect(liked.isLiked, isTrue);
      expect(liked.likeCount, 11);
      expect(liked.productTitle, 'Kurta');
      expect(liked.teamPricePkr, '800.00');
      expect(liked.isFollowing, isFalse);
    });
  });
}
