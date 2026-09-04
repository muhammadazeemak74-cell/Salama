import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens external links.
///
/// An interface rather than a direct `url_launcher` call so the buy flows can
/// be tested without a platform channel: launching is the last step of every
/// purchase, and a test that cannot reach it cannot check the flow.
abstract interface class UrlLauncherService {
  /// Opens [url] in whichever app claims it, leaving BoloShop in the
  /// background. Returns false when nothing on the device can handle it.
  Future<bool> launch(Uri url);
}

class PlatformUrlLauncher implements UrlLauncherService {
  const PlatformUrlLauncher();

  @override
  Future<bool> launch(Uri url) async {
    // externalApplication, not the in-app browser: the whole point of a wa.me
    // link is to land in WhatsApp with the message ready to send. An in-app
    // web view would show the "Continue to Chat" interstitial instead.
    try {
      return await launchUrl(url, mode: LaunchMode.externalApplication);
    } on Object {
      // A PlatformException here means no activity could handle the intent —
      // on Android that usually means WhatsApp is not installed.
      return false;
    }
  }
}

final urlLauncherProvider = Provider<UrlLauncherService>(
  (ref) => const PlatformUrlLauncher(),
);
