import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/session/session.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/pakistan_phone.dart';
import '../widgets/pakistan_phone_field.dart';
import 'otp_verify_screen.dart';

/// Sign in with a Pakistani mobile number.
///
/// There is no password anywhere in BoloShop. The phone is the identity —
/// it is what this market actually has, and it is what a cash-on-delivery
/// order rests on.
class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  static const routeName = '/login';

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final TextEditingController _controller = TextEditingController();

  bool _isSubmitting = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    // Re-evaluates the submit button as the number is typed.
    _controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onChanged() {
    // Clearing the error as soon as the number changes: leaving a stale
    // "invalid number" under a field somebody is actively fixing is noise.
    setState(() => _errorText = null);
  }

  bool get _canSubmit =>
      !_isSubmitting && isCompletePakistaniMobile(_controller.text);

  Future<void> _submit() async {
    final e164 = toE164(_controller.text);
    if (e164 == null) {
      setState(() {
        _errorText = 'Enter a Pakistani mobile number, like 300 1234567.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorText = null;
    });

    try {
      final challenge = await ref
          .read(sessionProvider.notifier)
          .requestOtp(e164);

      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => OtpVerifyScreen(
            phoneNumber: e164,
            resendAfterSeconds: challenge.resendAfterSeconds,
            devOtp: challenge.devOtp,
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        // The gateway's own message: it knows whether this was a bad number, a
        // resend cooldown, or an unreachable server, and says so in words a
        // person can act on.
        _errorText = error.message;
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: SafeArea(
        child: GestureDetector(
          // Tapping the background dismisses the keyboard, which otherwise
          // covers the submit button on a short screen.
          onTap: () => FocusScope.of(context).unfocus(),
          behavior: HitTestBehavior.opaque,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        gradient: AppColors.soloBuyGradient,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'BoloShop',
                        style: textTheme.labelLarge?.copyWith(
                          color: Colors.black,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 40),

                Text(
                  'Apna number daalein',
                  style: textTheme.headlineSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'We will send a 6-digit code to confirm it is you. '
                  'No password to remember.',
                  style: textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 28),

                PakistanPhoneField(
                  controller: _controller,
                  onSubmitted: _canSubmit ? _submit : () {},
                  errorText: _errorText,
                  enabled: !_isSubmitting,
                ),
                const SizedBox(height: 24),

                _SendCodeButton(
                  enabled: _canSubmit,
                  isSubmitting: _isSubmitting,
                  onPressed: _submit,
                ),
                const SizedBox(height: 20),

                Text(
                  'By continuing you agree to BoloShop’s terms. '
                  'Standard SMS charges may apply.',
                  textAlign: TextAlign.center,
                  style: textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SendCodeButton extends StatelessWidget {
  const _SendCodeButton({
    required this.enabled,
    required this.isSubmitting,
    required this.onPressed,
  });

  final bool enabled;
  final bool isSubmitting;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Send code',
      child: Opacity(
        opacity: enabled ? 1 : 0.4,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(16),
            child: Ink(
              decoration: BoxDecoration(
                gradient: AppColors.soloBuyGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.black,
                          ),
                        )
                      : Text(
                          'Send code',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
