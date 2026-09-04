/// Pakistani mobile numbers, and the E.164 form the backend stores.
///
/// The app shows `+92 3XX XXXXXXX` because that is how the number is read
/// aloud and printed on a shopfront. The gateway stores and validates E.164
/// (`+923XXXXXXXXX`), and its check constraint is the same regex the database
/// enforces — so the two forms are kept explicitly separate here rather than
/// hoping a text field produces the right one.
library;

/// The country calling code. Fixed: this app ships for one market.
const String pakistanDialCode = '+92';

/// A Pakistani mobile national number: 3 followed by nine digits.
///
/// Every mobile network in Pakistan (Jazz, Zong, Telenor, Ufone, SCO) issues
/// numbers in 3XX, so a leading 3 is what separates a mobile from a landline
/// that cannot receive an SMS.
final RegExp _nationalMobile = RegExp(r'^3[0-9]{9}$');

/// The gateway's E.164 shape, character for character:
/// `users_phone_number_e164` in 001_initial_schema.sql, and
/// `phoneNumberSchema` in the gateway's validation.ts.
final RegExp _e164 = RegExp(r'^\+[1-9][0-9]{7,14}$');

/// National significant number: digits only, no country code, no leading zero.
String nationalDigitsOf(String input) {
  var digits = input.replaceAll(RegExp(r'[^0-9]'), '');

  // Accept anything a person might type or paste: +92 300…, 0092 300…,
  // 92 300…, 0300…, or the bare 300….
  if (digits.startsWith('0092')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('92')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  return digits;
}

/// True when the national number is a complete Pakistani mobile.
bool isCompletePakistaniMobile(String input) =>
    _nationalMobile.hasMatch(nationalDigitsOf(input));

/// Converts anything the field accepts into E.164, or null if incomplete.
///
/// Null rather than a best guess: sending a half-typed number to the gateway
/// gets a 400 that reads like a server problem.
String? toE164(String input) {
  final digits = nationalDigitsOf(input);
  if (!_nationalMobile.hasMatch(digits)) return null;

  final candidate = '$pakistanDialCode$digits';
  return _e164.hasMatch(candidate) ? candidate : null;
}

/// True when a string is already in the gateway's E.164 form.
bool isE164(String value) => _e164.hasMatch(value);

/// Groups national digits for display: `3001234567` becomes `300 1234567`.
///
/// Grouped as 3+7, which is how the number is spoken and how it appears on a
/// business card here — not the 3+3+4 an international formatter would apply.
String formatNational(String digits) {
  final trimmed = digits.length > 10 ? digits.substring(0, 10) : digits;
  if (trimmed.length <= 3) return trimmed;
  return '${trimmed.substring(0, 3)} ${trimmed.substring(3)}';
}

/// The full display form: `+92 300 1234567`.
String formatForDisplay(String input) {
  final digits = nationalDigitsOf(input);
  if (digits.isEmpty) return pakistanDialCode;
  return '$pakistanDialCode ${formatNational(digits)}';
}
