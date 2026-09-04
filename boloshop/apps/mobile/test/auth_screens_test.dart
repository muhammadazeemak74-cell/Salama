import 'dart:async';

import 'package:boloshop/core/network/api_client.dart';
import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/core/theme/app_theme.dart';
import 'package:boloshop/features/auth/data/auth_repository.dart';
import 'package:boloshop/features/auth/presentation/screens/otp_verify_screen.dart';
import 'package:boloshop/features/auth/presentation/screens/phone_login_screen.dart';
import 'package:boloshop/features/feed/presentation/screens/feed_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

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

    testWidgets('offers a way back in for a demo build', (tester) async {
      // Signing out of a demo build lands here, and without this the login
      // screen is a dead end: the OTP it sends for has no gateway to come
      // from.
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [
            envConfigProvider.overrideWithValue(
              EnvConfig.from(flavorName: 'development', demoSignIn: true),
            ),
          ],
        ),
      );
      await tester.pump();

      expect(find.text('Browse as guest (demo)'), findsOneWidget);
    });

    testWidgets('never offers the guest shortcut in production', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrap(
          const PhoneLoginScreen(),
          overrides: [
            envConfigProvider.overrideWithValue(
              // Asking for it and being refused, which is the case that
              // matters: the flavour decides, not the flag.
              EnvConfig.from(flavorName: 'production', demoSignIn: true),
            ),
          ],
        ),
      );
      await tester.pump();

      expect(find.text('Browse as guest (demo)'), findsNothing);
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

    testWidgets('returns to the feed it was pushed over', (tester) async {
      // The usual case: someone tapped Buy on the feed, got sent to sign in,
      // and should come back to the product they were looking at.
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
            authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          ],
          child: MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(body: Center(child: Text('the feed'))),
            routes: {
              PhoneLoginScreen.routeName: (_) => const PhoneLoginScreen(),
            },
          ),
        ),
      );
      await tester.pump();

      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      unawaited(
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) => const OtpVerifyScreen(phoneNumber: '+923001234567'),
          ),
        ),
      );
      await tester.pumpAndSettleFrames();

      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      await tester.pumpAndSettleFrames();

      expect(find.text('the feed'), findsOneWidget);
      expect(find.byType(OtpVerifyScreen), findsNothing);
    });

    testWidgets('puts the feed on the stack when login was the entry point', (
      tester,
    ) async {
      // A signed-out cold start has nothing underneath, so popping would leave
      // someone who just signed in looking at the login screen.
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
            authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          ],
          // No `home`: MaterialApp maps '/' to it, and FeedScreen.routeName IS
          // '/', so a `home` here would make pushing the feed re-push this
          // screen. onGenerateInitialRoutes gives a one-route stack, which is
          // the "nothing underneath" case being tested.
          child: MaterialApp(
            theme: AppTheme.dark,
            initialRoute: '/verify',
            onGenerateInitialRoutes: (_) => [
              MaterialPageRoute<void>(
                builder: (_) => const OtpVerifyScreen(
                  phoneNumber: '+923001234567',
                  replaceStackWithFeed: true,
                ),
              ),
            ],
            onGenerateRoute: (settings) => settings.name == FeedScreen.routeName
                ? MaterialPageRoute<void>(builder: (_) => const FeedScreen())
                : null,
          ),
        ),
      );
      await tester.pump();

      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      await tester.pumpAndSettleFrames(30);

      expect(find.byType(FeedScreen), findsOneWidget);
      expect(find.byType(OtpVerifyScreen), findsNothing);
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

/// The feed and the auth screens both run repeating animations, so
/// [WidgetTester.pumpAndSettle] never settles. This pumps a bounded number of
/// frames instead, which is enough for a route transition to finish.
extension on WidgetTester {
  Future<void> pumpAndSettleFrames([int frames = 12]) async {
    for (var i = 0; i < frames; i++) {
      await pump(const Duration(milliseconds: 60));
    }
  }
}
