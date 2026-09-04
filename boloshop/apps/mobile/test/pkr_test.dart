import 'package:boloshop/core/utils/pkr.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatPkr', () {
    test('groups thousands and drops a zero fraction', () {
      expect(formatPkr('3500.00'), '₨ 3,500');
      expect(formatPkr('2450.00'), '₨ 2,450');
      expect(formatPkr('999'), '₨ 999');
      expect(formatPkr('1000'), '₨ 1,000');
      expect(formatPkr('1234567.00'), '₨ 1,234,567');
    });

    test('keeps a real fraction', () {
      expect(formatPkr('4499.50'), '₨ 4,499.50');
      expect(formatPkr('4499.5'), '₨ 4,499.50');
      expect(formatPkr('44.99'), '₨ 44.99');
      expect(formatPkr('1234567.05'), '₨ 1,234,567.05');
    });

    test('does not throw on malformed input', () {
      expect(formatPkr(''), '₨ 0');
      expect(formatPkr('abc'), '₨ abc');
    });
  });

  group('savingPercent', () {
    test('computes the team-buy saving', () {
      // The band the product is built around.
      expect(savingPercent(from: '3500.00', to: '2450.00'), 30);
      expect(savingPercent(from: '4200.00', to: '2940.00'), 30);
      expect(savingPercent(from: '1000.00', to: '800.00'), 20);
    });

    test('is exact where a double would drift', () {
      // 0.1 - 0.03 in binary floating point is 0.06999999999999999.
      expect(savingPercent(from: '0.10', to: '0.03'), 70);
    });

    test('returns null when there is nothing to save', () {
      expect(savingPercent(from: '1000.00', to: '1000.00'), isNull);
      expect(savingPercent(from: '1000.00', to: '1200.00'), isNull);
      expect(savingPercent(from: '0', to: '0'), isNull);
      expect(savingPercent(from: 'abc', to: '100'), isNull);
    });
  });
}
