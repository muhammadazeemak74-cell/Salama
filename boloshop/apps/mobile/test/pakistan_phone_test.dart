import 'package:boloshop/features/auth/domain/pakistan_phone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('nationalDigitsOf', () {
    test('strips whatever prefix a person typed or pasted', () {
      // All five of these are the same number, and all five get typed.
      expect(nationalDigitsOf('3001234567'), '3001234567');
      expect(nationalDigitsOf('03001234567'), '3001234567');
      expect(nationalDigitsOf('923001234567'), '3001234567');
      expect(nationalDigitsOf('+92 300 1234567'), '3001234567');
      expect(nationalDigitsOf('0092-300-1234567'), '3001234567');
    });

    test('drops separators a keyboard or a contact card inserts', () {
      expect(nationalDigitsOf('300-123-4567'), '3001234567');
      expect(nationalDigitsOf('(300) 1234567'), '3001234567');
    });
  });

  group('isCompletePakistaniMobile', () {
    test('accepts every mobile prefix in use here', () {
      // Jazz, Zong, Telenor, Ufone and SCO all issue 3XX.
      for (final number in [
        '3001234567',
        '3211234567',
        '3331234567',
        '3451234567',
      ]) {
        expect(isCompletePakistaniMobile(number), isTrue, reason: number);
      }
    });

    test('rejects a landline, which cannot receive the SMS', () {
      // Lahore 042, Karachi 021 — valid numbers, wrong kind.
      expect(isCompletePakistaniMobile('4235771234'), isFalse);
      expect(isCompletePakistaniMobile('2135771234'), isFalse);
    });

    test('rejects an incomplete or overlong number', () {
      expect(isCompletePakistaniMobile('300123456'), isFalse);
      expect(isCompletePakistaniMobile('30012345678'), isFalse);
      expect(isCompletePakistaniMobile(''), isFalse);
    });
  });

  group('toE164', () {
    test('produces exactly what the gateway schema accepts', () {
      expect(toE164('300 1234567'), '+923001234567');
      expect(toE164('03001234567'), '+923001234567');
      expect(toE164('+92 300 1234567'), '+923001234567');
    });

    test('matches the gateway and database regex', () {
      final e164 = toE164('3331234567')!;
      // users_phone_number_e164 in 001_initial_schema.sql, and
      // phoneNumberSchema in the gateway's validation.ts.
      expect(RegExp(r'^\+[1-9][0-9]{7,14}$').hasMatch(e164), isTrue);
      expect(isE164(e164), isTrue);
    });

    test('returns null rather than guessing at a half-typed number', () {
      // Sending this would earn a 400 that reads like a server fault.
      expect(toE164('300 123'), isNull);
      expect(toE164(''), isNull);
      expect(toE164('4235771234'), isNull);
    });
  });

  group('formatting', () {
    test('groups the national number the way it is spoken here', () {
      // 3+7, not the 3+3+4 an international formatter would apply.
      expect(formatNational('3001234567'), '300 1234567');
      expect(formatNational('300'), '300');
      expect(formatNational('30012'), '300 12');
      expect(formatNational(''), '');
    });

    test('never renders more than ten digits', () {
      expect(formatNational('300123456789'), '300 1234567');
    });

    test('renders the full display form', () {
      expect(formatForDisplay('+923001234567'), '+92 300 1234567');
      expect(formatForDisplay('03001234567'), '+92 300 1234567');
      expect(formatForDisplay(''), '+92');
    });
  });
}
