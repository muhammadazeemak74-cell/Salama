import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/screens/phone_login_screen.dart';
import 'features/feed/presentation/screens/feed_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

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
      initialRoute: FeedScreen.routeName,
      routes: {
        FeedScreen.routeName: (_) => const FeedScreen(),
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
