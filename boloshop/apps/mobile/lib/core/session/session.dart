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
    this.isDemo = false,
  });

  final SessionStatus status;

  /// The signed-in user's id, which the order service takes as `buyer_id`.
  final String? buyerId;
  final String? authToken;

  /// Present for a real sign-in and for the demo identity; absent only for the
  /// bare DEMO_BUYER_ID shortcut, which carries an id and nothing else.
  final AuthUser? user;

  /// Whether this identity came from [SessionController.signInAsDemo] rather
  /// than from an OTP the gateway verified. The UI says so out loud; nothing
  /// should ever present a demo session as a real one.
  final bool isDemo;

  bool get isAuthenticated => buyerId != null && buyerId!.isNotEmpty;
  bool get isRestoring => status == SessionStatus.restoring;

  /// The number to show on a profile screen, when there is one.
  String? get phoneNumber => user?.phoneNumber;

  Session copyWith({
    SessionStatus? status,
    String? buyerId,
    String? authToken,
    AuthUser? user,
    bool? isDemo,
  }) => Session(
    status: status ?? this.status,
    buyerId: buyerId ?? this.buyerId,
    authToken: authToken ?? this.authToken,
    user: user ?? this.user,
    isDemo: isDemo ?? this.isDemo,
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

      // A sign-in or a sign-out can land while secure storage is still being
      // read. This is the startup read — the weakest claim on the session —
      // so it yields to whatever happened rather than overwriting it. Without
      // this, signing out during a slow Keychain read silently signs you back
      // in a moment later.
      if (state.status != SessionStatus.restoring) return;

      if (stored == null) {
        // Demo is the fallback for having nothing stored, not a replacement
        // for a real session: a stored token below still wins, and signOut
        // still lands on the login screen rather than looping straight back
        // in here.
        if (ref.read(envConfigProvider).allowsDemoSignIn) {
          signInAsDemo();
          return;
        }
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
      // means signed out, not a crash on launch. In a demo build it means the
      // demo identity, for the same reason: a sideloaded APK whose secure
      // storage is unavailable should still open on the feed.
      if (state.status != SessionStatus.restoring) return;

      if (ref.read(envConfigProvider).allowsDemoSignIn) {
        signInAsDemo();
        return;
      }
      state = const Session(status: SessionStatus.signedOut);
    }
  }

  /// Enters the app as the demo buyer, with no OTP and no gateway.
  ///
  /// Refuses outside a development build. The screens this unlocks are the
  /// whole app, so the guard is an assertion about the build rather than a
  /// caller's promise — [EnvConfig.allowsDemoSignIn] is false in staging and
  /// production no matter what `--dart-define` was passed.
  void signInAsDemo() {
    final env = ref.read(envConfigProvider);
    if (!env.allowsDemoSignIn) {
      throw StateError(
        'Demo sign-in is development-only and this build is ${env.flavor.name}.',
      );
    }

    // No token: there is no gateway to present one to, and writing a fake
    // Authorization header would turn every request into a confusing 401
    // rather than an obvious "not signed in".
    ref.read(apiClientProvider).authToken = null;
    state = const Session(
      status: SessionStatus.signedIn,
      buyerId: demoBuyerId,
      isDemo: true,
      user: AuthUser(
        id: demoBuyerId,
        phoneNumber: demoPhoneNumber,
        role: 'buyer',
        languagePreference: 'urdu',
        isVerified: false,
      ),
    );
  }

  /// The demo identity's buyer id, stable so order flows have something to
  /// key on across a session.
  static const String demoBuyerId = 'demo-buyer';

  /// All-zero subscriber part, so it is well-formed enough to render in the
  /// drawer but cannot be anyone's actual number in a screenshot.
  static const String demoPhoneNumber = '+92 300 0000000';

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
