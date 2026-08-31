import 'package:boloshop/core/network/api_client.dart';
import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/core/theme/app_theme.dart';
import 'package:boloshop/features/auth/data/auth_repository.dart';
import 'package:boloshop/features/auth/presentation/screens/otp_verify_screen.dart';
import 'package:boloshop/features/auth/presentation/screens/phone_login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'session_controller_test.dart' show FakeAuthRepository;

Widget wrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: [
      tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
      ...overrides,
    ],
    child: MaterialApp(theme: AppTheme.dark, home: child),
  );
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('PhoneLoginScreen', () {
    testWidgets('shows the fixed +92 prefix and a Pakistani hint', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const PhoneLoginScreen()));
      await tester.pump();

      expect(find.text('+92'), findsOneWidget);
      expect(find.text('300 1234567'), findsOneWidget);
      expect(find.text('Send code'), findsOneWidget);
    });

    testWidgets('formats keystrokes as 3XX XXXXXXX', (tester) async {
      await tester.pumpWidget(wrap(const PhoneLoginScreen()));
      await tester.pump();

      await tester.enterText(find.byType(TextField), '3001234567');
      await tester.pump();

      expect(find.text('300 1234567'), findsWidgets);
    });

    testWidgets('strips a leading zero the way people type it', (tester) async {
      await tester.pumpWidget(wrap(const PhoneLoginScreen()));
      await tester.pump();

      await tester.enterText(find.byType(TextField), '03001234567');
      await tester.pump();

      // 0300… is how the number is written locally; the field keeps the
      // national form and the country code stays out of the way.
      expect(find.text('300 1234567'), findsWidgets);
    });

    testWidgets('will not send until the number is complete', (tester) async {
      final repository = FakeAuthRepository();
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '300123');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pump();

      expect(repository.requestedNumbers, isEmpty);
    });

    testWidgets('sends E.164 to the gateway, not what was typed', (
      tester,
    ) async {
      final repository = FakeAuthRepository();
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '3001234567');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(repository.requestedNumbers, ['+923001234567']);
    });

    testWidgets('shows the gateway message when it refuses', (tester) async {
      final repository = FakeAuthRepository(
        requestError: const ApiException(
          message: 'Please wait 60s before requesting another code.',
          code: 'too_many_requests',
          statusCode: 429,
        ),
      );
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '3001234567');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.text('Please wait 60s before requesting another code.'),
        findsOneWidget,
      );
    });

    testWidgets('moves to the OTP screen once a code is sent', (tester) async {
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [
            authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          ],
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '3001234567');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.byType(OtpVerifyScreen), findsOneWidget);
      expect(find.textContaining('+92 300 1234567'), findsOneWidget);
    });
  });

  group('OtpVerifyScreen', () {
    Widget otpScreen({int resendAfter = 60, String? devOtp}) => wrap(
      OtpVerifyScreen(
        phoneNumber: '+923001234567',
        resendAfterSeconds: resendAfter,
        devOtp: devOtp,
      ),
      overrides: [
        authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
      ],
    );

    testWidgets('renders six boxes and the number it sent to', (tester) async {
      await tester.pumpWidget(otpScreen());
      await tester.pump();

      expect(find.byType(AspectRatio), findsNWidgets(6));
      expect(find.textContaining('+92 300 1234567'), findsOneWidget);
    });

    testWidgets('starts a 60-second resend countdown', (tester) async {
      await tester.pumpWidget(otpScreen());
      await tester.pump();

      expect(find.text('Resend code in 60s'), findsOneWidget);
      expect(find.text('Resend code'), findsNothing);
    });

    testWidgets('counts down a second at a time', (tester) async {
      await tester.pumpWidget(otpScreen());
      await tester.pump();

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend code in 59s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 9));
      expect(find.text('Resend code in 50s'), findsOneWidget);
    });

    testWidgets('offers resend only once the window closes', (tester) async {
      await tester.pumpWidget(otpScreen(resendAfter: 3));
      await tester.pump();

      expect(find.text('Resend code in 3s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Resend code'), findsOneWidget);
      expect(find.textContaining('Resend code in'), findsNothing);
    });

    testWidgets('shows the digits as they are typed', (tester) async {
      await tester.pumpWidget(otpScreen());
      await tester.pump();

      await tester.enterText(find.byType(TextField), '123');
      await tester.pump();

      for (final digit in ['1', '2', '3']) {
        expect(find.text(digit), findsOneWidget);
      }
    });

    testWidgets('verifies automatically on the sixth digit', (tester) async {
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
          authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: OtpVerifyScreen(phoneNumber: '+923001234567'),
          ),
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // No submit button was pressed: typing the last digit is the submit.
      expect(container.read(sessionProvider).isAuthenticated, isTrue);
      expect(container.read(sessionProvider).authToken, 'jwt.token.value');
    });

    testWidgets('clears the field and explains when the code is wrong', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrap(
          const OtpVerifyScreen(phoneNumber: '+923001234567'),
          overrides: [
            authRepositoryProvider.overrideWithValue(
              FakeAuthRepository(
                verifyError: const ApiException(
                  message: 'That code is not valid. Request a new one.',
                  code: 'unauthorized',
                  statusCode: 401,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '000000');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(
        find.text('That code is not valid. Request a new one.'),
        findsOneWidget,
      );
      // Cleared, so the next attempt starts from an empty field rather than
      // making someone delete six digits.
      expect(find.text('0'), findsNothing);
    });

    testWidgets('labels the dev code rather than passing it off as real', (
      tester,
    ) async {
      await tester.pumpWidget(otpScreen(devOtp: '462258'));
      await tester.pump();

      expect(find.textContaining('Dev build'), findsOneWidget);
      expect(find.textContaining('462258'), findsOneWidget);
    });

    testWidgets('cancels its countdown when dismissed', (tester) async {
      await tester.pumpWidget(otpScreen());
      await tester.pump();

      // A periodic timer outliving the screen would fail this test outright,
      // which is the point of asserting it.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 5));
    });
  });
}
