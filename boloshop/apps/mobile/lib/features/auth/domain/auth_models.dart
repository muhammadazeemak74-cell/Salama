import 'package:flutter/foundation.dart';

/// What `POST /api/v1/auth/request-otp` returns.
@immutable
class OtpChallenge {
  const OtpChallenge({
    required this.phoneNumber,
    required this.expiresAt,
    required this.resendAfterSeconds,
    this.devOtp,
  });

  final String phoneNumber;
  final DateTime? expiresAt;

  /// How long before another code may be requested. The gateway enforces this
  /// too — an SMS gateway charges per message.
  final int resendAfterSeconds;

  /// The code itself, returned by the gateway outside production so the app
  /// can be exercised without an SMS provider wired up. Null in production.
  final String? devOtp;

  factory OtpChallenge.fromJson(Map<String, dynamic> json) {
    final expires = json['expires_at'];
    return OtpChallenge(
      phoneNumber: json['phone_number'] as String? ?? '',
      expiresAt: expires is String ? DateTime.tryParse(expires) : null,
      resendAfterSeconds: json['resend_after_seconds'] as int? ?? 60,
      devOtp: json['dev_otp'] as String?,
    );
  }
}

/// The signed-in user, as `POST /api/v1/auth/verify-otp` describes them.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.phoneNumber,
    required this.role,
    required this.languagePreference,
    required this.isVerified,
  });

  final String id;
  final String phoneNumber;

  /// buyer, seller or admin. Gates the seller-only screens.
  final String role;
  final String languagePreference;
  final bool isVerified;

  bool get isSeller => role == 'seller' || role == 'admin';

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String? ?? '',
    phoneNumber: json['phone_number'] as String? ?? '',
    role: json['role'] as String? ?? 'buyer',
    languagePreference: json['language_preference'] as String? ?? 'urdu',
    isVerified: json['is_verified'] as bool? ?? false,
  );
}

/// A successful verification: the token and who it belongs to.
@immutable
class AuthResult {
  const AuthResult({
    required this.token,
    required this.expiresInSeconds,
    required this.user,
  });

  final String token;
  final int expiresInSeconds;
  final AuthUser user;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
    token: json['token'] as String? ?? '',
    expiresInSeconds: json['expires_in'] as int? ?? 0,
    user: AuthUser.fromJson(
      json['user'] as Map<String, dynamic>? ?? const <String, dynamic>{},
    ),
  );
}
