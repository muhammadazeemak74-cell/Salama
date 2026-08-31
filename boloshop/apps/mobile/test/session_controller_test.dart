import 'package:boloshop/core/network/api_client.dart';
import 'package:boloshop/core/session/session.dart';
import 'package:boloshop/core/session/token_store.dart';
import 'package:boloshop/features/auth/data/auth_repository.dart';
import 'package:boloshop/features/auth/domain/auth_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Answers from memory, and records what it was asked.
class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.requestError, this.verifyError});

  final Object? requestError;
  final Object? verifyError;

  final List<String> requestedNumbers = [];
  final List<Map<String, String?>> verifications = [];

  @override
  Future<OtpChallenge> requestOtp(String phoneNumber) async {
    requestedNumbers.add(phoneNumber);
    if (requestError != null) throw requestError!;

    return OtpChallenge.fromJson(const {
      'status': 'sent',
      'phone_number': '+923001234567',
      'expires_at': '2026-08-31T12:00:00.000Z',
      'resend_after_seconds': 60,
      'dev_otp': '123456',
    });
  }

  @override
  Future<AuthResult> verifyOtp({
    required String phoneNumber,
    required String code,
    String? languagePreference,
  }) async {
    verifications.add({
      'phone_number': phoneNumber,
      'code': code,
      'language_preference': languagePreference,
    });
    if (verifyError != null) throw verifyError!;

    return AuthResult.fromJson(const {
      'token': 'jwt.token.value',
      'token_type': 'Bearer',
      'expires_in': 2592000,
      'user': {
        'id': '22222222-2222-2222-2222-222222222222',
        'phone_number': '+923001234567',
        'role': 'buyer',
        'language_preference': 'urdu',
        'is_verified': true,
      },
    });
  }
}

ProviderContainer makeContainer({
  FakeAuthRepository? repository,
  TokenStore? tokenStore,
}) {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        repository ?? FakeAuthRepository(),
      ),
      tokenStoreProvider.overrideWithValue(tokenStore ?? InMemoryTokenStore()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('restore', () {
    test('starts restoring, not signed out', () async {
      // The difference decides whether the first frame bounces an
      // already-signed-in user to the login screen.
      final container = makeContainer();

      expect(container.read(sessionProvider).status, SessionStatus.restoring);
      expect(container.read(sessionProvider).isRestoring, isTrue);
    });

    test('settles to signed out when nothing is stored', () async {
      final container = makeContainer();
      await container.read(sessionProvider.notifier).restore();

      expect(container.read(sessionProvider).status, SessionStatus.signedOut);
      expect(container.read(sessionProvider).isAuthenticated, isFalse);
    });

    test('signs in from a stored token', () async {
      final store = InMemoryTokenStore(
        const StoredSession(
          token: 'stored.jwt',
          userId: 'u-1',
          phoneNumber: '+923001234567',
          role: 'seller',
        ),
      );
      final container = makeContainer(tokenStore: store);

      await container.read(sessionProvider.notifier).restore();

      final session = container.read(sessionProvider);
      expect(session.status, SessionStatus.signedIn);
      expect(session.buyerId, 'u-1');
      expect(session.user?.role, 'seller');
      // The restored token has to reach the client, or every request after a
      // relaunch is anonymous while the UI says otherwise.
      expect(container.read(apiClientProvider).isAuthenticated, isTrue);
    });

    test(
      'treats an unreadable store as signed out rather than crashing',
      () async {
        final container = makeContainer(tokenStore: _ThrowingTokenStore());

        await container.read(sessionProvider.notifier).restore();

        expect(container.read(sessionProvider).status, SessionStatus.signedOut);
      },
    );
  });

  group('requestOtp', () {
    test('passes the number through and returns the challenge', () async {
      final repository = FakeAuthRepository();
      final container = makeContainer(repository: repository);

      final challenge = await container
          .read(sessionProvider.notifier)
          .requestOtp('+923001234567');

      expect(repository.requestedNumbers, ['+923001234567']);
      expect(challenge.resendAfterSeconds, 60);
      expect(challenge.devOtp, '123456');
    });

    test('does not sign anyone in', () async {
      final container = makeContainer();
      await container
          .read(sessionProvider.notifier)
          .requestOtp('+923001234567');

      expect(container.read(sessionProvider).isAuthenticated, isFalse);
    });

    test('surfaces the gateway error', () async {
      final container = makeContainer(
        repository: FakeAuthRepository(
          requestError: const ApiException(
            message: 'Please wait 60s before requesting another code.',
            code: 'too_many_requests',
            statusCode: 429,
          ),
        ),
      );

      await expectLater(
        container.read(sessionProvider.notifier).requestOtp('+923001234567'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('verifyOtp', () {
    test('stores the token, applies it, and updates the session', () async {
      final store = InMemoryTokenStore();
      final container = makeContainer(tokenStore: store);

      final user = await container
          .read(sessionProvider.notifier)
          .verifyOtp(phoneNumber: '+923001234567', code: '123456');

      expect(user.id, '22222222-2222-2222-2222-222222222222');

      final session = container.read(sessionProvider);
      expect(session.status, SessionStatus.signedIn);
      expect(session.buyerId, user.id);
      expect(session.authToken, 'jwt.token.value');
      expect(session.phoneNumber, '+923001234567');

      // All three places the credential lives.
      expect(container.read(apiClientProvider).isAuthenticated, isTrue);
      expect((await store.read())?.token, 'jwt.token.value');
    });

    test('passes the language preference when one is given', () async {
      final repository = FakeAuthRepository();
      final container = makeContainer(repository: repository);

      await container
          .read(sessionProvider.notifier)
          .verifyOtp(
            phoneNumber: '+923001234567',
            code: '123456',
            languagePreference: 'pashto',
          );

      expect(repository.verifications.single['language_preference'], 'pashto');
    });

    test('leaves the session signed out when the code is wrong', () async {
      final store = InMemoryTokenStore();
      final container = makeContainer(
        repository: FakeAuthRepository(
          verifyError: const ApiException(
            message: 'That code is not valid. Request a new one.',
            code: 'unauthorized',
            statusCode: 401,
          ),
        ),
        tokenStore: store,
      );
      await container.read(sessionProvider.notifier).restore();

      await expectLater(
        container
            .read(sessionProvider.notifier)
            .verifyOtp(phoneNumber: '+923001234567', code: '000000'),
        throwsA(isA<ApiException>()),
      );

      expect(container.read(sessionProvider).isAuthenticated, isFalse);
      // Nothing half-written: no token on the client, nothing in the store.
      expect(container.read(apiClientProvider).isAuthenticated, isFalse);
      expect(await store.read(), isNull);
    });
  });

  group('signOut', () {
    test('clears the session, the client and the store', () async {
      final store = InMemoryTokenStore();
      final container = makeContainer(tokenStore: store);

      await container
          .read(sessionProvider.notifier)
          .verifyOtp(phoneNumber: '+923001234567', code: '123456');
      expect(container.read(sessionProvider).isAuthenticated, isTrue);

      await container.read(sessionProvider.notifier).signOut();

      expect(container.read(sessionProvider).status, SessionStatus.signedOut);
      expect(container.read(sessionProvider).buyerId, isNull);
      expect(container.read(apiClientProvider).isAuthenticated, isFalse);
      expect(await store.read(), isNull);
    });
  });
}

class _ThrowingTokenStore implements TokenStore {
  @override
  Future<StoredSession?> read() async =>
      throw Exception('keychain unavailable');

  @override
  Future<void> write(StoredSession session) async {}

  @override
  Future<void> clear() async {}
}
