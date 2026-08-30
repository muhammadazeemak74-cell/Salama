import 'package:boloshop/features/feed/data/feed_repository.dart';
import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:boloshop/features/voice/domain/voice_filter.dart';
import 'package:flutter_test/flutter_test.dart';

FeedItem item({
  String title = 'Product',
  String specs = '',
  String solo = '5000.00',
  String team = '4000.00',
}) => FeedItem(
  id: 'x',
  sellerId: 's',
  productTitle: title,
  fabricSpecs: specs,
  soloPricePkr: solo,
  teamPricePkr: team,
  storeName: 'Store',
  sellerHandle: '@store',
  city: 'Lahore',
  likeCount: 0,
  commentCount: 0,
  isLive: false,
  liveViewerCount: 0,
);

void main() {
  group('chip labels', () {
    test('are exactly what the design calls for', () {
      expect(VoiceFilter.lawnSuits.label, 'Lawn Suits');
      expect(VoiceFilter.underThreeThousand.label, '< ₨ 3,000');
      expect(VoiceFilter.freeDelivery.label, 'Free Delivery');
    });
  });

  group('lawnSuits', () {
    test('matches the title or the fabric specs, case-insensitively', () {
      expect(
        VoiceFilter.lawnSuits.matches(item(title: '3-Piece Lawn Suit')),
        isTrue,
      );
      expect(
        VoiceFilter.lawnSuits.matches(item(specs: 'Pure lawn, digital print')),
        isTrue,
      );
      expect(VoiceFilter.lawnSuits.matches(item(title: 'LAWN suit')), isTrue);
    });

    test('does not match unrelated products', () {
      expect(
        VoiceFilter.lawnSuits.matches(item(title: 'Wireless Earbuds')),
        isFalse,
      );
    });
  });

  group('underThreeThousand', () {
    test('matches on the price the buyer can actually reach', () {
      // Solo ₨3,500 but team ₨2,450: a group-buy app must not hide this from
      // an "under ₨3,000" search.
      expect(
        VoiceFilter.underThreeThousand.matches(
          item(solo: '3500.00', team: '2450.00'),
        ),
        isTrue,
      );
    });

    test('excludes anything still over the ceiling', () {
      expect(
        VoiceFilter.underThreeThousand.matches(
          item(solo: '5800.00', team: '4060.00'),
        ),
        isFalse,
      );
    });

    test('treats exactly 3,000 as over the ceiling', () {
      expect(
        VoiceFilter.underThreeThousand.matches(item(team: '3000.00')),
        isFalse,
      );
      expect(
        VoiceFilter.underThreeThousand.matches(item(team: '2999.99')),
        isTrue,
      );
    });

    test('never matches an unparseable price', () {
      expect(
        VoiceFilter.underThreeThousand.matches(item(team: 'abc')),
        isFalse,
      );
    });
  });

  group('freeDelivery', () {
    test('reads the spec line', () {
      expect(
        VoiceFilter.freeDelivery.matches(
          item(specs: 'Cotton net • Free delivery'),
        ),
        isTrue,
      );
      expect(
        VoiceFilter.freeDelivery.matches(item(specs: 'Cotton net')),
        isFalse,
      );
    });
  });

  group('applyFilters', () {
    test('an empty set is everything', () {
      expect(applyFilters(sampleFeed, const {}), sampleFeed);
    });

    test('filters combine with AND', () {
      final lawnOnly = applyFilters(sampleFeed, {VoiceFilter.lawnSuits});
      expect(lawnOnly, hasLength(1));
      expect(lawnOnly.single.productTitle, contains('Lawn Suit'));

      // The spoken query in the modal: "3,000 PKR tak ka lawn suit".
      final both = applyFilters(sampleFeed, {
        VoiceFilter.lawnSuits,
        VoiceFilter.underThreeThousand,
      });
      expect(both, hasLength(1));

      // Nothing in the sample feed is both a lawn suit and free delivery.
      final impossible = applyFilters(sampleFeed, {
        VoiceFilter.lawnSuits,
        VoiceFilter.freeDelivery,
      });
      expect(impossible, isEmpty);
    });
  });
}
