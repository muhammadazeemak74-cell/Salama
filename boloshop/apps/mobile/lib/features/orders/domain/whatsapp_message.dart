/// The WhatsApp links this app opens.
///
/// Two shapes, for two different jobs:
///
///   `https://wa.me/<digits>?text=...`  opens a chat with one number
///   `https://wa.me/?text=...`          opens the contact picker
///
/// The order confirmation uses the first — the order service builds that link
/// itself, addressed to the seller — and the team invite uses the second,
/// because the friend being invited is whoever the buyer picks.
library;

/// Builds a share link for a team purchase.
///
/// [shareUrl] is the link the order service generated for the team purchase;
/// it goes in the message so the friend can actually join.
Uri teamInviteLink({
  required String shareUrl,
  required String productTitle,
  required int discountPct,
  String? storeName,
}) {
  final store = storeName == null || storeName.isEmpty
      ? ''
      : ' from $storeName';

  final message = StringBuffer()
    ..writeln('Join my group purchase on BoloShop to get $discountPct% off!')
    ..writeln()
    ..writeln('$productTitle$store')
    ..writeln()
    ..writeln('Tap to join — the offer closes in 24 hours:')
    ..write(shareUrl);

  // Uri's own encoding, not a hand-rolled escape: a product title is seller
  // input and will contain &, # and ? sooner or later.
  return Uri.https('wa.me', '/', {'text': message.toString()});
}

/// Parses a wa.me URL the backend built. Returns null when it is empty or
/// malformed, so a caller can fail loudly rather than launching nothing.
Uri? parseWhatsAppUrl(String url) {
  if (url.trim().isEmpty) return null;

  final parsed = Uri.tryParse(url.trim());
  if (parsed == null || !parsed.hasScheme) return null;
  if (parsed.scheme != 'https' && parsed.scheme != 'http') return null;

  return parsed;
}
