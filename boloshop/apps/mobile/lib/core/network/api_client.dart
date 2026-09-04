import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env_config.dart';

// Which backend a call is for, and where that backend lives, are one decision
// — see core/config/env_config.dart. Re-exported so call sites keep importing
// only the client.
export '../config/env_config.dart'
    show ApiService, AppFlavor, EnvConfig, envConfigProvider;

/// A failure the app can show a user.
///
/// Both backends return the same envelope, so one exception type covers the
/// whole API surface:
///
///   {"error":{"code":"insufficient_credits","message":"...","details":[...]}}
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.code,
    this.statusCode,
    this.fieldErrors = const <String, String>{},
  });

  /// Human-readable, safe to put in a SnackBar.
  final String message;

  /// Machine-readable code, e.g. `invalid_status_transition`.
  final String? code;

  final int? statusCode;

  /// Field path to message, from the `details` array on a validation failure.
  final Map<String, String> fieldErrors;

  /// True when the request never reached the server. Worth distinguishing on a
  /// patchy mobile connection: "you are offline" and "we said no" are
  /// different problems for the person holding the phone.
  bool get isConnectivityFailure => statusCode == null;

  @override
  String toString() => 'ApiException(${code ?? 'network'}: $message)';
}

/// The HTTP client for both BoloShop backends.
///
/// One instance per app, held by [apiClientProvider]. Dio is configured once
/// here — timeouts, auth header, error translation — so no call site has to
/// remember any of it.
class ApiClient {
  ApiClient({required EnvConfig env, Dio? gatewayDio, Dio? ordersDio})
    : _env = env,
      _clients = {
        ApiService.gateway:
            gatewayDio ?? _buildDio(env.baseUrlFor(ApiService.gateway)),
        ApiService.orders:
            ordersDio ?? _buildDio(env.baseUrlFor(ApiService.orders)),
      };

  final EnvConfig _env;
  final Map<ApiService, Dio> _clients;

  String? _authToken;

  /// Where this build points. Read it rather than a literal anywhere else.
  EnvConfig get env => _env;

  /// The JWT from `POST /api/v1/auth/verify-otp`. Sent on every subsequent
  /// request to either service.
  set authToken(String? token) => _authToken = token;

  bool get isAuthenticated => _authToken != null;

  static Dio _buildDio(String baseUrl) => Dio(
    BaseOptions(
      baseUrl: baseUrl,
      // Generous by desktop standards, deliberately: a 3G handover in
      // Lahore routinely costs several seconds, and failing at 5s would
      // mean retrying work the server already did.
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      responseType: ResponseType.json,
      headers: const {'Accept': 'application/json'},
      // Non-2xx is handled by translating the body, not by throwing raw.
      validateStatus: (status) => status != null && status < 500,
    ),
  );

  Dio dioFor(ApiService service) => _clients[service]!;

  /// GET, returning the decoded JSON object.
  Future<Map<String, dynamic>> get(
    ApiService service,
    String path, {
    Map<String, dynamic>? query,
  }) => _send(service, 'GET', path, query: query);

  /// POST a JSON body, returning the decoded JSON object.
  Future<Map<String, dynamic>> post(
    ApiService service,
    String path, {
    Map<String, dynamic>? body,
  }) => _send(service, 'POST', path, body: body);

  Future<Map<String, dynamic>> _send(
    ApiService service,
    String method,
    String path, {
    Map<String, dynamic>? query,
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await dioFor(service).request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(
          method: method,
          headers: {
            if (body != null) 'Content-Type': 'application/json',
            if (_authToken != null) 'Authorization': 'Bearer $_authToken',
          },
        ),
      );

      final status = response.statusCode ?? 0;
      final data = response.data;

      if (status >= 400) {
        throw _translate(status, data);
      }

      if (data is Map<String, dynamic>) return data;
      if (data == null) return const <String, dynamic>{};

      throw ApiException(
        message: 'The server returned an unexpected response.',
        code: 'malformed_response',
        statusCode: status,
      );
    } on DioException catch (error) {
      throw _fromDioException(error);
    }
  }

  /// Turns the shared error envelope into an [ApiException].
  ApiException _translate(int status, dynamic data) {
    if (data is Map<String, dynamic>) {
      final error = data['error'];
      if (error is Map<String, dynamic>) {
        final fieldErrors = <String, String>{};
        final details = error['details'];
        if (details is List) {
          for (final detail in details) {
            if (detail is Map<String, dynamic>) {
              final path = detail['path'];
              final message = detail['message'];
              if (path is String && message is String) {
                fieldErrors[path] = message;
              }
            }
          }
        }

        return ApiException(
          message: error['message'] as String? ?? 'Something went wrong.',
          code: error['code'] as String?,
          statusCode: status,
          fieldErrors: fieldErrors,
        );
      }
    }

    return ApiException(
      message: 'Something went wrong. Please try again.',
      statusCode: status,
    );
  }

  ApiException _fromDioException(DioException error) {
    // A 5xx still arrives as a response thanks to validateStatus.
    final response = error.response;
    if (response != null) {
      return _translate(response.statusCode ?? 500, response.data);
    }

    final message = switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'The connection timed out. Check your signal and try again.',
      DioExceptionType.connectionError =>
        'Cannot reach BoloShop. Check your internet connection.',
      DioExceptionType.badCertificate =>
        'The connection is not secure. Please update the app.',
      DioExceptionType.cancel => 'Request cancelled.',
      _ => 'Cannot reach BoloShop. Check your internet connection.',
    };

    return ApiException(message: message, code: 'network_error');
  }

  void close() {
    for (final dio in _clients.values) {
      dio.close(force: true);
    }
  }
}

/// The app-wide client, pointed wherever [envConfigProvider] says.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(env: ref.watch(envConfigProvider));
  ref.onDispose(client.close);
  return client;
});
