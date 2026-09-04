/// PKR formatting.
///
/// Amounts travel from the backend as strings — they are NUMERIC(12,2) in
/// Postgres, and a double cannot hold every rupee value exactly — so they are
/// formatted here without ever being parsed into one.
library;

/// Formats a decimal amount string for display: `"3500.00"` becomes
/// `"₨ 3,500"`, `"2449.50"` becomes `"₨ 2,449.50"`.
///
/// Anything unparseable is returned with the symbol and no grouping rather
/// than throwing: a malformed price should still render something.
String formatPkr(String amount) => '₨ ${formatPkrDigits(amount)}';

/// The same, without the currency symbol, for use next to a separate label.
String formatPkrDigits(String amount) {
  final trimmed = amount.trim();
  if (trimmed.isEmpty) return '0';

  final dot = trimmed.indexOf('.');
  final whole = dot == -1 ? trimmed : trimmed.substring(0, dot);
  final fraction = dot == -1 ? '' : trimmed.substring(dot + 1);

  if (whole.isEmpty ||
      !whole
          .split('')
          .every((c) => c.compareTo('0') >= 0 && c.compareTo('9') <= 0)) {
    return trimmed;
  }

  final grouped = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) grouped.write(',');
    grouped.write(whole[i]);
  }

  // Trailing ".00" is noise on a price tag; anything else is the price.
  final padded = fraction
      .padRight(2, '0')
      .substring(0, fraction.isEmpty ? 0 : 2);
  if (padded.isEmpty || padded == '00') return grouped.toString();
  return '${grouped.toString()}.$padded';
}

/// Whole-percent saving between two amount strings, for the "Save 30%" badge.
///
/// Returns null when the discount is not a positive saving, so the caller can
/// omit the badge instead of rendering "Save 0%".
int? savingPercent({required String from, required String to}) {
  final fromPaisa = pkrToPaisa(from);
  final toPaisa = pkrToPaisa(to);
  if (fromPaisa == null || toPaisa == null || fromPaisa <= 0) return null;

  final saved = fromPaisa - toPaisa;
  if (saved <= 0) return null;

  return ((saved * 100) / fromPaisa).round();
}

/// Parses `"3500.50"` into 350050 paisa, or null if it is not an amount.
///
/// Integer paisa keeps the arithmetic exact where a double would not, so
/// anything that has to add prices up — a running order total, a cart —
/// does it here rather than on parsed doubles.
int? pkrToPaisa(String amount) {
  final trimmed = amount.trim();
  final dot = trimmed.indexOf('.');
  final whole = dot == -1 ? trimmed : trimmed.substring(0, dot);
  final fraction = dot == -1 ? '' : trimmed.substring(dot + 1);

  final wholeValue = int.tryParse(whole);
  if (wholeValue == null) return null;

  final fractionValue = fraction.isEmpty
      ? 0
      : int.tryParse(fraction.padRight(2, '0').substring(0, 2));
  if (fractionValue == null) return null;

  return wholeValue * 100 + fractionValue;
}

/// The inverse of [pkrToPaisa]: 350050 becomes `"3500.50"`.
///
/// Produces the same decimal-string shape the backend sends, so a locally
/// summed total formats through [formatPkr] exactly like a server-sent one.
String paisaToAmount(int paisa) {
  final sign = paisa < 0 ? '-' : '';
  final absolute = paisa.abs();
  final fraction = (absolute % 100).toString().padLeft(2, '0');
  return '$sign${absolute ~/ 100}.$fraction';
}
