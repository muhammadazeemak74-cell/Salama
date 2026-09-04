import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// What a signed-in session persists between launches.
@immutable
class StoredSession {
  const StoredSession({
    required this.token,
    required this.userId,
    required this.phoneNumber,
    required this.role,
  });

  final String token;
  final String userId;
  final String phoneNumber;
  final String role;

  Map<String, dynamic> toJson() => {
    'token': token,
    'user_id': userId,
    'phone_number': phoneNumber,
    'role': role,
  };

  static StoredSession? fromJson(Map<String, dynamic> json) {
    final token = json['token'];
    final userId = json['user_id'];
    final phoneNumber = json['phone_number'];
    final role = json['role'];

    // A partially-written record is treated as no record: signing back in is
    // cheap, and half a session is worse than none.
    if (token is! String || userId is! String) return null;

    return StoredSession(
      token: token,
      userId: userId,
      phoneNumber: phoneNumber is String ? phoneNumber : '',
      role: role is String ? role : 'buyer',
    );
  }
}

/// Where the JWT lives between launches.
///
/// An interface so the session can be tested without a platform channel —
/// flutter_secure_storage talks to the Keychain and the Android Keystore, and
/// neither exists in a widget test.
abstract interface class TokenStore {
  Future<StoredSession?> read();
  Future<void> write(StoredSession session);
  Future<void> clear();
}

/// The real one: Keychain on iOS, EncryptedSharedPreferences on Android.
///
/// A JWT is a bearer credential — anything holding it is the user for 30 days
/// — so it does not go in SharedPreferences, which is world-readable on a
/// rooted device and included in Android's automatic backups.
class SecureTokenStore implements TokenStore {
  const SecureTokenStore([
    this._storage = const FlutterSecureStorage(
      // flutter_secure_storage 11 defaults to AES-GCM with the key wrapped by
      // the Android Keystore, so the old encryptedSharedPreferences flag is
      // gone and the defaults are the strong path.
      //
      // first_unlock rather than the `unlocked` default: the app should be able
      // to restore a session in the background after a reboot, before the
      // first manual unlock, which `unlocked` would block.
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    ),
  ]);

  final FlutterSecureStorage _storage;

  static const _key = 'boloshop.session';

  @override
  Future<StoredSession?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return StoredSession.fromJson(decoded);
    } on FormatException {
      // Corrupt or from an incompatible version: drop it rather than trap the
      // user in a launch that fails the same way every time.
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(StoredSession session) =>
      _storage.write(key: _key, value: jsonEncode(session.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// In-memory, for tests and for a build with no platform channels.
class InMemoryTokenStore implements TokenStore {
  InMemoryTokenStore([this._session]);

  StoredSession? _session;

  @override
  Future<StoredSession?> read() async => _session;

  @override
  Future<void> write(StoredSession session) async => _session = session;

  @override
  Future<void> clear() async => _session = null;
}

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => const SecureTokenStore(),
);
