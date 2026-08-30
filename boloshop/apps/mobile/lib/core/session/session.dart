import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Who is using the app.
///
/// There is no sign-in screen yet. The gateway's OTP endpoints exist
/// (`POST /api/v1/auth/request-otp` then `verify-otp`), but nothing in the app
/// calls them, so until that lands the buyer id comes from a build-time define:
///
///   flutter run --dart-define=DEMO_BUYER_ID=<a verified user's uuid>
///
/// This is deliberately not a hardcoded fallback UUID. An order placed against
/// an invented buyer would be rejected by the order service with a 404 that
/// reads like a server fault; a missing identity should say "sign in", because
/// that is the actual problem.
class Session {
  const Session({this.buyerId, this.authToken});

  final String? buyerId;
  final String? authToken;

  bool get isAuthenticated => buyerId != null && buyerId!.isNotEmpty;

  Session copyWith({String? buyerId, String? authToken}) => Session(
    buyerId: buyerId ?? this.buyerId,
    authToken: authToken ?? this.authToken,
  );
}

class SessionController extends Notifier<Session> {
  @override
  Session build() {
    const demoBuyerId = String.fromEnvironment('DEMO_BUYER_ID');
    return Session(buyerId: demoBuyerId.isEmpty ? null : demoBuyerId);
  }

  /// Called by the OTP flow once it exists.
  void signIn({required String buyerId, required String authToken}) {
    state = Session(buyerId: buyerId, authToken: authToken);
  }

  void signOut() => state = const Session();
}

final sessionProvider = NotifierProvider<SessionController, Session>(
  SessionController.new,
);
