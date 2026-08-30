import '../../feed/domain/feed_item.dart';

/// The filters Bolo can pull out of a spoken query.
///
/// A fixed set rather than free-form text: the transcription is the fuzzy part
/// of this feature, and turning "3,000 tak ka lawn suit" into three chips a
/// buyer can see and correct is more honest than silently searching for a
/// string nobody can inspect.
enum VoiceFilter {
  lawnSuits('Lawn Suits'),
  underThreeThousand('< ₨ 3,000'),
  freeDelivery('Free Delivery');

  const VoiceFilter(this.label);

  /// What the chip says.
  final String label;

  /// Below this counts as "under ₨ 3,000", in paisa.
  static const int _underThresholdPaisa = 300000;

  bool matches(FeedItem item) => switch (this) {
    VoiceFilter.lawnSuits => _mentions(item, 'lawn'),
    // Matched against the lowest price the buyer can actually reach, which
    // is the team price. A group-buy app that hides a ₨2,450 suit from a
    // "under ₨3,000" search because its solo price is ₨3,500 is hiding its
    // own product.
    VoiceFilter.underThreeThousand =>
      _paisa(item.teamPricePkr) < _underThresholdPaisa,
    VoiceFilter.freeDelivery => _mentions(item, 'free delivery'),
  };

  static bool _mentions(FeedItem item, String needle) {
    final haystack = '${item.productTitle} ${item.fabricSpecs}'.toLowerCase();
    return haystack.contains(needle);
  }

  /// Parses "3500.00" into 350000 paisa. Integer paisa, never a double.
  static int _paisa(String amount) {
    final trimmed = amount.trim();
    final dot = trimmed.indexOf('.');
    final whole = int.tryParse(dot == -1 ? trimmed : trimmed.substring(0, dot));
    if (whole == null) return 1 << 40; // Unparseable never matches a ceiling.

    final fractionText = dot == -1 ? '' : trimmed.substring(dot + 1);
    final fraction = fractionText.isEmpty
        ? 0
        : int.tryParse(fractionText.padRight(2, '0').substring(0, 2)) ?? 0;

    return whole * 100 + fraction;
  }
}

/// Applies a filter set to the feed. An empty set means "everything".
///
/// Filters combine with AND: each chip a buyer leaves on narrows the feed.
List<FeedItem> applyFilters(List<FeedItem> items, Set<VoiceFilter> filters) {
  if (filters.isEmpty) return items;
  return items
      .where((item) => filters.every((filter) => filter.matches(item)))
      .toList(growable: false);
}
