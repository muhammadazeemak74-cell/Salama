import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/session/session.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/screens/phone_login_screen.dart';
import 'features/feed/presentation/screens/feed_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  registerFontLicenses();

  // The feed is the product, so it gets the whole panel: the system bars stay
  // visible but transparent, and the video runs underneath them.
  SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.edgeToEdge,
    overlays: SystemUiOverlay.values,
  );
  SystemChrome.setSystemUIOverlayStyle(AppTheme.immersiveOverlay);

  // Locked to portrait. A vertical video feed has no landscape story, and
  // allowing the rotation only produces a broken one.
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const ProviderScope(child: BoloShopApp()));
}

/// Puts the bundled fonts' licence on the app's licences page.
///
/// Inter and Noto Nastaliq Urdu ship under the SIL Open Font License, which
/// requires the licence to accompany the fonts wherever they go — including
/// into an APK. `google_fonts` used to do this for us; bundling the files
/// ourselves means doing it ourselves.
void registerFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString('assets/fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(const <String>[
      'Inter',
      'Noto Nastaliq Urdu',
    ], license);
  });
}

class BoloShopApp extends StatelessWidget {
  const BoloShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BoloShop',
      debugShowCheckedModeBanner: false,
      // Dark only, on purpose: see AppTheme.
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      // The root route is the gate, not the feed. FeedScreen.routeName is
      // still what everything navigates to — it means "the app's home", and
      // the gate decides whether home is the feed or the login screen.
      initialRoute: FeedScreen.routeName,
      routes: {
        FeedScreen.routeName: (_) => const AuthGate(),
        PhoneLoginScreen.routeName: (_) => const PhoneLoginScreen(),
      },
      // Named routes will grow to product detail, checkout and team-buy; an
      // unknown one lands somewhere honest rather than on a red screen.
      onUnknownRoute: (settings) => MaterialPageRoute<void>(
        builder: (_) => _RouteNotFound(routeName: settings.name),
      ),
      builder: (context, child) {
        // Product prices and CTAs must stay legible at large accessibility
        // font sizes without the buttons falling apart, so the scale is
        // clamped rather than ignored.
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: media.textScaler.clamp(
              minScaleFactor: 0.9,
              maxScaleFactor: 1.3,
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}

/// The first screen, chosen by whether a token survived the last run.
///
/// [SessionController] reads secure storage on construction, so the three
/// states here are the three the session can be in on a cold start:
///
///   restoring -> a held frame, because a token usually IS there and bouncing
///                a signed-in user to the login screen for one frame is worse
///                than a moment of nothing
///   signedIn  -> the feed
///   signedOut -> sign in
///
/// It watches rather than reads, so signing out anywhere in the app lands back
/// here without that code having to know what the root route should become.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(sessionProvider.select((session) => session.status));

    return switch (status) {
      SessionStatus.restoring => const _RestoringSplash(),
      SessionStatus.signedIn => const FeedScreen(),
      SessionStatus.signedOut => const PhoneLoginScreen(),
    };
  }
}

/// Held while the Keychain read is in flight. Deliberately close to the login
/// screen's own background, so the handover is a fade of content rather than a
/// flash of a different colour.
class _RestoringSplash extends StatelessWidget {
  const _RestoringSplash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: AppColors.primaryGreen,
          ),
        ),
      ),
    );
  }
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({this.routeName});

  final String? routeName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.explore_off_outlined,
                size: 44,
                color: AppColors.textTertiary,
              ),
              const SizedBox(height: 14),
              Text(
                'That screen does not exist yet.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (routeName != null) ...[
                const SizedBox(height: 6),
                Text(
                  routeName!,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: AppColors.textTertiary),
                ),
              ],
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil(
                  FeedScreen.routeName,
                  (route) => false,
                ),
                child: const Text('Back to the feed'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
