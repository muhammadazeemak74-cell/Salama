import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/domain/auth_models.dart';
import '../network/api_client.dart';
import 'token_store.dart';

/// Where the session is in its lifecycle.
enum SessionStatus {
  /// Reading the stored token. The first frame is here.
  restoring,

  /// Nobody is signed in.
  signedOut,

  /// A token is held and attached to every request.
  signedIn,
}

/// Who is using the app.
@immutable
class Session {
  const Session({
    this.status = SessionStatus.signedOut,
    this.buyerId,
    this.authToken,
    this.user,
  });

  final SessionStatus status;

  /// The signed-in user's id, which the order service takes as `buyer_id`.
  final String? buyerId;
  final String? authToken;

  /// Present for a real sign-in; absent for the DEMO_BUYER_ID shortcut.
  final AuthUser? user;

  bool get isAuthenticated => buyerId != null && buyerId!.isNotEmpty;
  bool get isRestoring => status == SessionStatus.restoring;

  /// The number to show on a profile screen, when there is one.
  String? get phoneNumber => user?.phoneNumber;

  Session copyWith({
    SessionStatus? status,
    String? buyerId,
    String? authToken,
    AuthUser? user,
  }) => Session(
    status: status ?? this.status,
    buyerId: buyerId ?? this.buyerId,
    authToken: authToken ?? this.authToken,
    user: user ?? this.user,
  );
}

/// Owns the signed-in identity.
///
/// The token is the app's only credential, so three things happen together and
/// must not drift apart: the in-memory session, the `Authorization` header on
/// [ApiClient], and the copy in secure storage. Every transition here writes
/// all three.
class SessionController extends Notifier<Session> {
  @override
  Session build() {
    // A build-time identity for exercising order flows without an SMS
    // provider. A real sign-in replaces it; it is not a fallback for one.
    const demoBuyerId = String.fromEnvironment('DEMO_BUYER_ID');

    if (demoBuyerId.isNotEmpty) {
      return Session(status: SessionStatus.signedIn, buyerId: demoBuyerId);
    }

    // Restoring, not signed out: the difference decides whether the first
    // frame shows the feed or bounces someone to the login screen who is in
    // fact already signed in.
    Future<void>.microtask(restore);
    return const Session(status: SessionStatus.restoring);
  }

  /// Reads the stored token and applies it, if there is one.
  Future<void> restore() async {
    try {
      final stored = await ref.read(tokenStoreProvider).read();
      if (stored == null) {
        state = const Session(status: SessionStatus.signedOut);
        return;
      }

      _apply(
        token: stored.token,
        user: AuthUser(
          id: stored.userId,
          phoneNumber: stored.phoneNumber,
          role: stored.role,
          languagePreference: 'urdu',
          isVerified: true,
        ),
      );
    } on Object {
      // A store that cannot be read — a wiped Keychain, a corrupt record —
      // means signed out, not a crash on launch.
      state = const Session(status: SessionStatus.signedOut);
    }
  }

  /// Asks the gateway to send a code. Throws [ApiException] on failure.
  Future<OtpChallenge> requestOtp(String phoneNumber) =>
      ref.read(authRepositoryProvider).requestOtp(phoneNumber);

  /// Exchanges a code for a token, then persists and applies it.
  Future<AuthUser> verifyOtp({
    required String phoneNumber,
    required String code,
    String? languagePreference,
  }) async {
    final result = await ref
        .read(authRepositoryProvider)
        .verifyOtp(
          phoneNumber: phoneNumber,
          code: code,
          languagePreference: languagePreference,
        );

    // Persist before applying: a token in memory that never reached storage
    // would sign the user out again on the next launch with no explanation.
    await ref
        .read(tokenStoreProvider)
        .write(
          StoredSession(
            token: result.token,
            userId: result.user.id,
            phoneNumber: result.user.phoneNumber,
            role: result.user.role,
          ),
        );

    _apply(token: result.token, user: result.user);
    return result.user;
  }

  /// Drops the token everywhere it is held.
  Future<void> signOut() async {
    ref.read(apiClientProvider).authToken = null;
    state = const Session(status: SessionStatus.signedOut);
    await ref.read(tokenStoreProvider).clear();
  }

  void _apply({required String token, required AuthUser user}) {
    ref.read(apiClientProvider).authToken = token;
    state = Session(
      status: SessionStatus.signedIn,
      buyerId: user.id,
      authToken: token,
      user: user,
    );
  }
}

final sessionProvider = NotifierProvider<SessionController, Session>(
  SessionController.new,
);
