import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/session/session.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../feed/presentation/screens/feed_screen.dart';
import '../../domain/pakistan_phone.dart';

/// Enter the six digits the gateway sent.
///
/// Verification is what actually creates the account: the gateway upserts on
/// the phone number, so a returning buyer keeps their id, role and order
/// history, and a new one is created already verified.
class OtpVerifyScreen extends ConsumerStatefulWidget {
  const OtpVerifyScreen({
    required this.phoneNumber,
    this.resendAfterSeconds = 60,
    this.devOtp,
    this.replaceStackWithFeed = false,
    super.key,
  });

  static const routeName = '/verify';

  /// E.164, as sent to the gateway.
  final String phoneNumber;

  /// How long before another code may be requested. The gateway enforces the
  /// same window, so counting down to something shorter would just produce a
  /// 429 the buyer did not expect.
  final int resendAfterSeconds;

  /// Outside production the gateway returns the code it generated, so the app
  /// can be driven without an SMS provider. Shown as a labelled hint.
  final String? devOtp;

  /// Whether signing in has to put the feed on the stack itself.
  ///
  /// True when login was the app's entry point — a signed-out cold start —
  /// because there is then nothing underneath to return to, and popping would
  /// leave someone who just signed in staring at the login screen.
  ///
  /// False when login was pushed over the feed, where returning to it is both
  /// correct and better: it keeps the product they were looking at, and lets
  /// the buy they were part-way through resume.
  final bool replaceStackWithFeed;

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  static const int _codeLength = 6;

  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  Timer? _ticker;
  int _secondsRemaining = 0;
  bool _isVerifying = false;
  bool _isResending = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onCodeChanged);
    _startCountdown(widget.resendAfterSeconds);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _controller.removeListener(_onCodeChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _ticker?.cancel();
    setState(() => _secondsRemaining = seconds);

    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_secondsRemaining <= 1) {
        timer.cancel();
        setState(() => _secondsRemaining = 0);
        return;
      }
      setState(() => _secondsRemaining -= 1);
    });
  }

  void _onCodeChanged() {
    // Only a keystroke clears the error, never the programmatic reset that
    // follows a rejection: _verify clears the field so the next attempt starts
    // empty, and if that also wiped the message the buyer would be left with a
    // blank screen and no idea why their code failed.
    if (_controller.text.isNotEmpty && _errorText != null) {
      setState(() => _errorText = null);
    } else {
      setState(() {});
    }

    // Submit on the sixth digit. Making someone reach for a button after
    // typing the last digit of a code they just read off a notification is a
    // step for nothing.
    if (_controller.text.length == _codeLength && !_isVerifying) {
      unawaited(_verify());
    }
  }

  Future<void> _verify() async {
    final code = _controller.text;
    if (code.length != _codeLength) return;

    setState(() {
      _isVerifying = true;
      _errorText = null;
    });

    try {
      await ref
          .read(sessionProvider.notifier)
          .verifyOtp(phoneNumber: widget.phoneNumber, code: code);

      if (!mounted) return;
      final navigator = Navigator.of(context);

      // The JWT is in secure storage and on the client by this point; all that
      // is left is to land the person in the app.
      if (widget.replaceStackWithFeed) {
        await navigator.pushNamedAndRemoveUntil(
          FeedScreen.routeName,
          (route) => false,
        );
      } else {
        navigator.popUntil((route) => route.isFirst);
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorText = error.message;
        _isVerifying = false;
      });
      _controller.clear();
      _focusNode.requestFocus();
    } on Object {
      if (!mounted) return;
      setState(() {
        _errorText = 'Could not verify the code. Please try again.';
        _isVerifying = false;
      });
    }
  }

  Future<void> _resend() async {
    if (_secondsRemaining > 0 || _isResending) return;

    setState(() {
      _isResending = true;
      _errorText = null;
    });

    try {
      final challenge = await ref
          .read(sessionProvider.notifier)
          .requestOtp(widget.phoneNumber);

      if (!mounted) return;
      _controller.clear();
      _startCountdown(challenge.resendAfterSeconds);
      _focusNode.requestFocus();

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              'New code sent to ${formatForDisplay(widget.phoneNumber)}',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _errorText = error.message);
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
          tooltip: 'Back',
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Code daalein',
                style: textTheme.headlineSmall?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  style: textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                  children: [
                    const TextSpan(text: 'We sent 6 digits to '),
                    TextSpan(
                      text: formatForDisplay(widget.phoneNumber),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              _OtpBoxes(
                controller: _controller,
                focusNode: _focusNode,
                length: _codeLength,
                hasError: _errorText != null,
                enabled: !_isVerifying,
              ),

              if (_errorText != null) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 15,
                      color: AppColors.electricRose,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _errorText!,
                        style: textTheme.bodySmall?.copyWith(
                          color: AppColors.electricRose,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              // The gateway only returns dev_otp outside production, but the
              // build decides too: a staging APK talks to a real SMS provider,
              // and printing a live code on screen hands anyone holding the
              // phone a valid session.
              if (widget.devOtp != null &&
                  ref.watch(envConfigProvider).showsDevOtp) ...[
                const SizedBox(height: 16),
                _DevCodeHint(code: widget.devOtp!),
              ],

              const SizedBox(height: 24),
              if (_isVerifying)
                const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primaryGreen,
                    ),
                  ),
                ),

              const SizedBox(height: 24),
              _ResendRow(
                secondsRemaining: _secondsRemaining,
                isResending: _isResending,
                onResend: _resend,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Six boxes over one hidden field.
///
/// A single TextField behind the boxes rather than six real ones: it keeps
/// paste, autofill from an SMS, and backspace-across-boxes working, all of
/// which have to be rebuilt by hand in a six-controller version.
class _OtpBoxes extends StatelessWidget {
  const _OtpBoxes({
    required this.controller,
    required this.focusNode,
    required this.length,
    required this.hasError,
    required this.enabled,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final int length;
  final bool hasError;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Stack(
      children: [
        // The real field, invisible but focusable and full width so a tap
        // anywhere on the row opens the keyboard.
        Positioned.fill(
          child: Opacity(
            opacity: 0,
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              enabled: enabled,
              autofocus: true,
              keyboardType: TextInputType.number,
              // Lets iOS and Android offer the code straight from the SMS.
              autofillHints: const [AutofillHints.oneTimeCode],
              maxLength: length,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(length),
              ],
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
              ),
            ),
          ),
        ),
        GestureDetector(
          onTap: () => focusNode.requestFocus(),
          behavior: HitTestBehavior.opaque,
          child: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(length, (index) {
                  final filled = index < value.text.length;
                  final isNext = index == value.text.length;

                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: index == length - 1 ? 0 : 8,
                      ),
                      child: AspectRatio(
                        aspectRatio: 0.78,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.surfaceRaised,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: hasError
                                  ? AppColors.electricRose
                                  : isNext
                                  ? AppColors.primaryGreen
                                  : AppColors.cardBorder,
                              width: isNext || hasError ? 2 : 1,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              filled ? value.text[index] : '',
                              style: textTheme.headlineSmall?.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// The 60-second countdown, then a live resend link.
class _ResendRow extends StatelessWidget {
  const _ResendRow({
    required this.secondsRemaining,
    required this.isResending,
    required this.onResend,
  });

  final int secondsRemaining;
  final bool isResending;
  final VoidCallback onResend;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final canResend = secondsRemaining == 0 && !isResending;

    if (isResending) {
      return Center(
        child: Text(
          'Sending…',
          style: textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
        ),
      );
    }

    if (!canResend) {
      return Center(
        child: Text(
          // Counted in whole seconds because that is what the gateway's
          // Retry-After header reports.
          'Resend code in ${secondsRemaining}s',
          style: textTheme.bodyMedium?.copyWith(color: AppColors.textTertiary),
        ),
      );
    }

    return Center(
      child: Semantics(
        button: true,
        label: 'Resend code',
        child: TextButton(
          onPressed: onResend,
          child: Text(
            'Resend code',
            style: textTheme.titleSmall?.copyWith(
              color: AppColors.primaryGreen,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

/// The code the gateway handed back outside production, labelled as such.
class _DevCodeHint extends StatelessWidget {
  const _DevCodeHint({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.construction_outlined,
            size: 15,
            color: AppColors.textTertiary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Dev build — the gateway returned $code',
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: AppColors.textTertiary),
            ),
          ),
        ],
      ),
    );
  }
}
