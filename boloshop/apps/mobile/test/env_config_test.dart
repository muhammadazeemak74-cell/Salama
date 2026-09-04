import 'package:boloshop/core/config/env_config.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppFlavor.parse', () {
    test('reads the three environments', () {
      expect(AppFlavor.parse('development'), AppFlavor.development);
      expect(AppFlavor.parse('staging'), AppFlavor.staging);
      expect(AppFlavor.parse('production'), AppFlavor.production);
    });

    test('is forgiving about case and whitespace', () {
      expect(AppFlavor.parse('  Production '), AppFlavor.production);
    });

    test('defaults to development when nothing was passed', () {
      // `flutter run` with no --dart-define is a developer on localhost.
      expect(AppFlavor.parse(''), AppFlavor.development);
    });

    test('throws on an unknown name rather than guessing', () {
      // A typo'd APP_ENV=prod that quietly built a production APK pointed at
      // localhost would not surface until the first user opened it.
      expect(() => AppFlavor.parse('prod'), throwsArgumentError);
    });
  });

  group('development', () {
    test('points at the local services', () {
      final env = EnvConfig.from(
        flavorName: '',
        platform: TargetPlatform.iOS,
      );

      expect(env.gatewayBaseUrl, 'http://localhost:4000');
      expect(env.orderServiceBaseUrl, 'http://localhost:4002');
      expect(env.isDevelopment, isTrue);
    });

    test('uses the host loopback alias on Android', () {
      // localhost inside an emulator is the emulator, so a plain localhost URL
      // fails in a way that looks exactly like the server being down.
      final env = EnvConfig.from(
        flavorName: 'development',
        platform: TargetPlatform.android,
      );

      expect(env.gatewayBaseUrl, 'http://10.0.2.2:4000');
      expect(env.orderServiceBaseUrl, 'http://10.0.2.2:4002');
    });

    test('allows cleartext, which is the whole point of localhost', () {
      expect(
        () => EnvConfig.from(
          flavorName: 'development',
          gatewayOverride: 'http://192.168.1.5:4000',
          platform: TargetPlatform.android,
        ),
        returnsNormally,
      );
    });
  });

  group('staging and production', () {
    test('each has its own hostnames', () {
      final staging = EnvConfig.from(flavorName: 'staging');
      final production = EnvConfig.from(flavorName: 'production');

      expect(staging.gatewayBaseUrl, 'https://staging-api.boloshop.pk');
      expect(staging.orderServiceBaseUrl, 'https://staging-orders.boloshop.pk');
      expect(production.gatewayBaseUrl, 'https://api.boloshop.pk');
      expect(production.orderServiceBaseUrl, 'https://orders.boloshop.pk');
    });

    test('never falls back to localhost on Android', () {
      // The emulator alias is a development affordance; a release build that
      // inherited it would reach nothing at all.
      final env = EnvConfig.from(
        flavorName: 'production',
        platform: TargetPlatform.android,
      );

      expect(env.gatewayBaseUrl, isNot(contains('10.0.2.2')));
      expect(env.gatewayBaseUrl, startsWith('https://'));
    });

    test('refuses a cleartext override', () {
      // Every request carries the session JWT, a bearer credential good for
      // thirty days.
      expect(
        () => EnvConfig.from(
          flavorName: 'production',
          gatewayOverride: 'http://api.boloshop.pk',
        ),
        throwsArgumentError,
      );
      expect(
        () => EnvConfig.from(
          flavorName: 'staging',
          ordersOverride: 'http://orders.staging.boloshop.pk',
        ),
        throwsArgumentError,
      );
    });

    test('hides the gateway dev code', () {
      // Staging talks to a real SMS provider; printing a live code on screen
      // would hand anyone holding the phone a valid session.
      expect(EnvConfig.from(flavorName: 'staging').showsDevOtp, isFalse);
      expect(EnvConfig.from(flavorName: 'production').showsDevOtp, isFalse);
      expect(EnvConfig.from(flavorName: '').showsDevOtp, isTrue);
    });
  });

  group('overrides', () {
    test('an explicit URL wins over the flavour default', () {
      // What testing against a preview deployment needs.
      final env = EnvConfig.from(
        flavorName: 'staging',
        gatewayOverride: 'https://pr-42.boloshop.pk',
      );

      expect(env.gatewayBaseUrl, 'https://pr-42.boloshop.pk');
      // The one that was not overridden keeps the flavour's default.
      expect(env.orderServiceBaseUrl, 'https://staging-orders.boloshop.pk');
    });

    test('whitespace-only is treated as absent', () {
      final env = EnvConfig.from(
        flavorName: 'production',
        gatewayOverride: '   ',
      );

      expect(env.gatewayBaseUrl, 'https://api.boloshop.pk');
    });
  });

  group('allowsDemoSignIn', () {
    test('is on in a development build that asked for it', () {
      final env = EnvConfig.from(flavorName: 'development', demoSignIn: true);
      expect(env.allowsDemoSignIn, isTrue);
    });

    test('is off in a development build that opted out', () {
      // --dart-define=DEMO_SIGN_IN=false, to exercise the real login flow
      // against a running gateway.
      final env = EnvConfig.from(flavorName: 'development', demoSignIn: false);
      expect(env.allowsDemoSignIn, isFalse);
    });

    test('cannot be turned on outside development', () {
      // The whole point of the flag: no --dart-define combination ships an
      // app that lets someone past the login screen without an OTP.
      for (final flavor in ['staging', 'production']) {
        final env = EnvConfig.from(flavorName: flavor, demoSignIn: true);
        expect(
          env.allowsDemoSignIn,
          isFalse,
          reason: '$flavor must not allow a demo sign-in',
        );
      }
    });

    test('defaults to off when the caller says nothing', () {
      // Only EnvConfig.resolve() opts in, from the compile-time define.
      expect(EnvConfig.from(flavorName: 'development').allowsDemoSignIn, isFalse);
      expect(const EnvConfig(
        flavor: AppFlavor.development,
        gatewayBaseUrl: 'http://localhost:4000',
        orderServiceBaseUrl: 'http://localhost:4002',
      ).allowsDemoSignIn, isFalse);
    });
  });

  test('baseUrlFor routes each service to its own backend', () {
    final env = EnvConfig.from(flavorName: 'production');

    expect(env.baseUrlFor(ApiService.gateway), env.gatewayBaseUrl);
    expect(env.baseUrlFor(ApiService.orders), env.orderServiceBaseUrl);
    expect(
      env.baseUrlFor(ApiService.gateway),
      isNot(env.baseUrlFor(ApiService.orders)),
    );
  });
}
