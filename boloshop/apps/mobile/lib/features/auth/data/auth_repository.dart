import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/auth_models.dart';

/// Calls the Express gateway's auth endpoints.
class AuthRepository {
  const AuthRepository(this._client);

  final ApiClient _client;

  /// `POST /api/v1/auth/request-otp`
  ///
  /// [phoneNumber] must already be E.164 — the gateway validates it against
  /// the same regex the database enforces, and a half-typed number comes back
  /// as a 400 that reads like a server fault.
  Future<OtpChallenge> requestOtp(String phoneNumber) async {
    final response = await _client.post(
      ApiService.gateway,
      '/api/v1/auth/request-otp',
      body: {'phone_number': phoneNumber},
    );
    return OtpChallenge.fromJson(response);
  }

  /// `POST /api/v1/auth/verify-otp`
  ///
  /// Creates the user on first sight and returns a JWT. A returning buyer
  /// keeps their id, role and order history.
  Future<AuthResult> verifyOtp({
    required String phoneNumber,
    required String code,
    String? languagePreference,
  }) async {
    final response = await _client.post(
      ApiService.gateway,
      '/api/v1/auth/verify-otp',
      body: {
        'phone_number': phoneNumber,
        'code': code,
        'language_preference': ?languagePreference,
      },
    );
    return AuthResult.fromJson(response);
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);
