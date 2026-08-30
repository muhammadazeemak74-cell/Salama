import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// The floating green "Bolo 🎙️" button.
///
/// "Bolo" is Urdu for "speak", and that is the whole interaction model: a buyer
/// who cannot type a product name in English can say it. It stays visible over
/// every page of the feed because it is the app's primary input, not a feature
/// tucked into a menu.
class BoloVoiceButton extends StatefulWidget {
  const BoloVoiceButton({required this.onPressed, this.isListening = false, super.key});

  final VoidCallback onPressed;
  final bool isListening;

  @override
  State<BoloVoiceButton> createState() => _BoloVoiceButtonState();
}

class _BoloVoiceButtonState extends State<BoloVoiceButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // A wider halo while listening, so the state is legible at a glance
        // without a second label.
        final glow = widget.isListening ? 0.45 + 0.35 * _controller.value : 0.28;
        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryGreen.withValues(alpha: glow),
                blurRadius: widget.isListening ? 24 : 14,
                spreadRadius: widget.isListening ? 3 : 0,
              ),
            ],
          ),
          child: child,
        );
      },
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: widget.onPressed,
          borderRadius: BorderRadius.circular(999),
          child: Ink(
            decoration: BoxDecoration(
              gradient: AppColors.soloBuyGradient,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Bolo',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Colors.black,
                          fontWeight: FontWeight.w800,
                          height: 1,
                        ),
                  ),
                  const SizedBox(width: 6),
                  const Text('🎙️', style: TextStyle(fontSize: 15, height: 1)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
