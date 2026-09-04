import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Which backend a request is going to.
///
/// BoloShop is two services behind one app: the Express gateway owns auth,
/// catalog and media, and the Go service owns orders, tracking and team buys.
/// They are separate ports in development and separate hostnames in
/// production, so the app never hardcodes one and hopes.
enum ApiService {
  /// services/api-gateway — auth, products, media.
  gateway,

  /// services/order-service — orders, tracking, team purchases.
  orders,
}

/// Which deployment this build talks to.
enum AppFlavor {
  development,
  staging,
  production;

  /// Parses `--dart-define=APP_ENV=...`. Empty means development.
  ///
  /// An unrecognised value throws rather than falling back. A typo'd
  /// `APP_ENV=prod` that quietly built a production APK pointed at
  /// `http://localhost:4000` is the exact failure this whole file exists to
  /// prevent, and it would not show up until the first user opened the app.
  static AppFlavor parse(String raw) {
    final name = raw.trim().toLowerCase();
    if (name.isEmpty) return AppFlavor.development;

    for (final flavor in AppFlavor.values) {
      if (flavor.name == name) return flavor;
    }

    throw ArgumentError.value(
      raw,
      'APP_ENV',
      'Unknown environment. Expected one of: '
          '${AppFlavor.values.map((flavor) => flavor.name).join(', ')}',
    );
  }
}

/// Where this build points, and what it is allowed to do.
///
/// Selected at compile time, because it must be impossible to change from
/// inside a shipped app:
///
///     flutter run                                        # development
///     flutter build appbundle --dart-define=APP_ENV=staging
///     flutter build appbundle --dart-define=APP_ENV=production
///
/// Either URL can still be overridden on its own, which is what a developer
/// testing against a colleague's machine or a preview deployment needs:
///
///     flutter run --dart-define=GATEWAY_BASE_URL=https://pr-42.boloshop.pk
@immutable
class EnvConfig {
  const EnvConfig({
    required this.flavor,
    required this.gatewayBaseUrl,
    required this.orderServiceBaseUrl,
    this.allowsDemoSignIn = false,
  });

  final AppFlavor flavor;
  final String gatewayBaseUrl;
  final String orderServiceBaseUrl;

  bool get isDevelopment => flavor == AppFlavor.development;
  bool get isProduction => flavor == AppFlavor.production;

  /// Whether the gateway's `dev_otp` may be shown on the verify screen.
  ///
  /// Development only. Staging talks to a real SMS provider, and printing a
  /// live code on screen would hand anyone holding the phone a valid session.
  bool get showsDevOtp => isDevelopment;

  /// Whether the app may put itself in a signed-in state with no OTP.
  ///
  /// On by default in development, because a development build points at
  /// `localhost` and a sideloaded APK has no backend to point at: the login
  /// screen requests a code that never arrives, so every screen behind it is
  /// unreachable and the build cannot be reviewed at all. This makes the feed
  /// the launch screen instead.
  ///
  /// Turn it off to exercise the real login flow against a running gateway:
  ///
  ///     flutter run --dart-define=DEMO_SIGN_IN=false
  ///
  /// Never true outside development. [from] ands it with the flavour, so no
  /// combination of `--dart-define` produces a staging or production build
  /// that skips authentication — passing the flag there changes nothing.
  final bool allowsDemoSignIn;

  String baseUrlFor(ApiService service) => switch (service) {
    ApiService.gateway => gatewayBaseUrl,
    ApiService.orders => orderServiceBaseUrl,
  };

  /// The configuration for the running build.
  factory EnvConfig.resolve() => EnvConfig.from(
    flavorName: const String.fromEnvironment('APP_ENV'),
    gatewayOverride: const String.fromEnvironment('GATEWAY_BASE_URL'),
    ordersOverride: const String.fromEnvironment('ORDER_SERVICE_BASE_URL'),
    demoSignIn: const bool.fromEnvironment('DEMO_SIGN_IN', defaultValue: true),
  );

  /// The resolution itself, with its inputs passed in so it can be tested
  /// without rebuilding the app under a different `--dart-define`.
  factory EnvConfig.from({
    required String flavorName,
    String gatewayOverride = '',
    String ordersOverride = '',
    bool demoSignIn = false,
    TargetPlatform? platform,
  }) {
    final flavor = AppFlavor.parse(flavorName);

    final gateway = gatewayOverride.trim().isNotEmpty
        ? gatewayOverride.trim()
        : _defaultUrl(flavor, ApiService.gateway, platform);
    final orders = ordersOverride.trim().isNotEmpty
        ? ordersOverride.trim()
        : _defaultUrl(flavor, ApiService.orders, platform);

    if (flavor != AppFlavor.development) {
      _requireHttps(flavor, 'GATEWAY_BASE_URL', gateway);
      _requireHttps(flavor, 'ORDER_SERVICE_BASE_URL', orders);
    }

    return EnvConfig(
      flavor: flavor,
      gatewayBaseUrl: gateway,
      orderServiceBaseUrl: orders,
      // The `&&` is the guard, not the caller's promise.
      allowsDemoSignIn: demoSignIn && flavor == AppFlavor.development,
    );
  }

  /// Cleartext outside development is refused, loudly and at startup.
  ///
  /// Every request carries the session JWT, which is a bearer credential for
  /// thirty days — over http on a Pakistani mobile network that is readable by
  /// anyone on the path. Android also blocks cleartext by default, so the
  /// alternative to this message is a build that fails on every screen with a
  /// connection error and no explanation.
  ///
  /// The inputs are compile-time constants, so a build that would throw here
  /// throws the first time anyone opens it — never only in a user's hands.
  static void _requireHttps(AppFlavor flavor, String name, String url) {
    if (url.startsWith('https://')) return;
    throw ArgumentError.value(
      url,
      name,
      '${flavor.name} builds must use https. Set '
          '--dart-define=$name=https://...',
    );
  }

  static String _defaultUrl(
    AppFlavor flavor,
    ApiService service,
    TargetPlatform? platform,
  ) => switch (flavor) {
    AppFlavor.development => _localhost(
      service == ApiService.gateway ? 4000 : 4002,
      platform,
    ),
    AppFlavor.staging => switch (service) {
      ApiService.gateway => 'https://staging-api.boloshop.pk',
      ApiService.orders => 'https://staging-orders.boloshop.pk',
    },
    AppFlavor.production => switch (service) {
      ApiService.gateway => 'https://api.boloshop.pk',
      ApiService.orders => 'https://orders.boloshop.pk',
    },
  };

  /// The Android emulator quirk, handled rather than documented-and-forgotten:
  /// `localhost` inside an emulator is the emulator itself, not the
  /// developer's machine, so `http://localhost:4000` fails there in a way that
  /// looks exactly like the server being down. 10.0.2.2 is the host loopback
  /// alias.
  static String _localhost(int port, TargetPlatform? platform) {
    final target = platform ?? defaultTargetPlatform;
    final host = !kIsWeb && target == TargetPlatform.android
        ? '10.0.2.2'
        : 'localhost';
    return 'http://$host:$port';
  }

  @override
  String toString() =>
      'EnvConfig(${flavor.name}, gateway: $gatewayBaseUrl, '
      'orders: $orderServiceBaseUrl)';
}

/// The configuration for this build. Overridden in tests.
final envConfigProvider = Provider<EnvConfig>((ref) => EnvConfig.resolve());
