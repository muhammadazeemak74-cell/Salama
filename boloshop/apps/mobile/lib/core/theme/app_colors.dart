import 'package:flutter/material.dart';

/// The BoloShop palette.
///
/// The feed is edge-to-edge video, so every colour here has to hold up over an
/// arbitrary photograph. That is why the surfaces are translucent black rather
/// than opaque greys, and why the two accents are fully saturated: on a phone
/// held at arm's length in daylight, anything softer disappears into the video.
abstract final class AppColors {
  // --- Brand accents --------------------------------------------------------

  /// Primary green. Commerce, "go", and the Bolo voice button.
  static const Color primaryGreen = Color(0xFF00C853);

  /// Electric rose. Urgency: live badges, team-buy savings, the liked heart.
  static const Color electricRose = Color(0xFFFF2A6D);

  /// A deeper green for pressed states and gradient ends.
  static const Color primaryGreenDeep = Color(0xFF00933C);

  /// A deeper rose, same purpose.
  static const Color electricRoseDeep = Color(0xFFD1004E);

  // --- Backgrounds ----------------------------------------------------------

  /// The app background. Near-black with a blue cast, so it reads as
  /// deliberate rather than as an unlit screen.
  static const Color darkBackground = Color(0xFF0F0F12);

  /// One step up, for sheets and dialogs that sit above the feed.
  static const Color surface = Color(0xFF17171C);

  /// One step up again, for chips and inputs inside those sheets.
  static const Color surfaceRaised = Color(0xFF212129);

  // --- Translucent card and scrim shades ------------------------------------
  //
  // These sit directly on video. Opacity is doing the work: enough to carry
  // text, little enough that the product stays visible underneath.

  /// The product card over the video.
  static const Color cardOverlay = Color(0xCC101014);

  /// A lighter card, for secondary chips over video.
  static const Color cardOverlaySoft = Color(0x99101014);

  /// Hairline borders on translucent cards.
  static const Color cardBorder = Color(0x1FFFFFFF);

  /// Top scrim, under the status bar and the live badge.
  static const Color scrimTop = Color(0x8A000000);

  /// Bottom scrim, under the product card. Heavier: it carries the price.
  static const Color scrimBottom = Color(0xD9000000);

  /// Fully transparent, for the middle of a scrim gradient.
  static const Color scrimTransparent = Color(0x00000000);

  /// The pill behind an icon in the right-hand interaction column.
  static const Color iconWell = Color(0x40000000);

  // --- Content --------------------------------------------------------------

  /// Primary text and icons over video.
  static const Color textPrimary = Color(0xFFFFFFFF);

  /// Secondary text: fabric specs, counts, captions.
  static const Color textSecondary = Color(0xB3FFFFFF);

  /// Tertiary text: struck-through prices, timestamps.
  static const Color textTertiary = Color(0x80FFFFFF);

  /// WhatsApp brand green, for the share affordance only. It is deliberately
  /// not [primaryGreen]: this button opens someone else's app, and pretending
  /// otherwise would be dishonest.
  static const Color whatsApp = Color(0xFF25D366);

  /// Live-indicator dot.
  static const Color liveDot = Color(0xFF00E676);

  // --- Gradients ------------------------------------------------------------

  /// The solo-buy call to action.
  static const LinearGradient soloBuyGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryGreen, primaryGreenDeep],
  );

  /// The team-buy call to action. Rose, so the cheaper option is also the
  /// louder one.
  static const LinearGradient teamBuyGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [electricRose, electricRoseDeep],
  );

  /// Top-of-frame scrim so white icons survive a bright video.
  static const LinearGradient topScrimGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [scrimTop, scrimTransparent],
  );

  /// Bottom-of-frame scrim behind the product card.
  static const LinearGradient bottomScrimGradient = LinearGradient(
    begin: Alignment.bottomCenter,
    end: Alignment.topCenter,
    colors: [scrimBottom, scrimTransparent],
  );

  /// Placeholder backdrop for a page whose video has not loaded yet. Deriving
  /// it from the product id keeps each page visually distinct while it waits.
  static LinearGradient posterGradient(int seed) {
    const palettes = <List<Color>>[
      [Color(0xFF1B2A4A), Color(0xFF0F0F12)],
      [Color(0xFF3A1B3D), Color(0xFF0F0F12)],
      [Color(0xFF14322B), Color(0xFF0F0F12)],
      [Color(0xFF3D2A14), Color(0xFF0F0F12)],
    ];
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: palettes[seed.abs() % palettes.length],
    );
  }
}
