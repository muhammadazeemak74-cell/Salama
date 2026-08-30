import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// The app's single theme.
///
/// BoloShop is dark only. The product is full-bleed video, and a light chrome
/// around it would fight every frame; there is no light variant to fall back to
/// on purpose.
abstract final class AppTheme {
  /// Overlay style for a screen that is entirely video: white status-bar icons,
  /// transparent bars so the feed runs under them.
  static const SystemUiOverlayStyle immersiveOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarDividerColor: Colors.transparent,
  );

  static ThemeData get dark {
    const colorScheme = ColorScheme.dark(
      primary: AppColors.primaryGreen,
      onPrimary: Colors.black,
      secondary: AppColors.electricRose,
      onSecondary: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.electricRose,
      onError: Colors.white,
    );

    // Inter carries Urdu-adjacent Latin transliteration and long product names
    // at small sizes better than the platform defaults, and it ships a real
    // 800 weight for the price row.
    final textTheme = GoogleFonts.interTextTheme(ThemeData.dark().textTheme)
        .apply(
          bodyColor: AppColors.textPrimary,
          displayColor: AppColors.textPrimary,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.darkBackground,
      canvasColor: AppColors.darkBackground,
      textTheme: textTheme,
      // The feed owns the whole frame; app bars are transparent when present.
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        systemOverlayStyle: immersiveOverlay,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.cardBorder,
        thickness: 1,
        space: 1,
      ),
      // A feed is flicked, not scrolled; the bouncing physics reads as
      // responsive where the Android glow does not.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: <TargetPlatform, PageTransitionsBuilder>{
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      splashFactory: InkSparkle.splashFactory,
    );
  }
}
