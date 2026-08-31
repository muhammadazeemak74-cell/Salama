import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/pakistan_phone.dart';

/// Formats keystrokes as `3XX XXXXXXX` while keeping the raw digits.
///
/// The country code is not in the field: it is a fixed prefix drawn beside it,
/// so it cannot be deleted, and a buyer typing their number the way they say
/// it out loud does not have to think about `+92` at all.
class PakistanPhoneInputFormatter extends TextInputFormatter {
  const PakistanPhoneInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = nationalDigitsOf(newValue.text);
    final formatted = formatNational(digits);

    // Keep the caret where the person is typing rather than snapping it to the
    // end, which is what makes editing the middle of a number possible.
    final digitsBeforeCaret = newValue.text
        .substring(
          0,
          newValue.selection.baseOffset.clamp(0, newValue.text.length),
        )
        .replaceAll(RegExp(r'[^0-9]'), '')
        .length;

    var offset = 0;
    var seen = 0;
    while (offset < formatted.length && seen < digitsBeforeCaret) {
      if (formatted.codeUnitAt(offset) != 0x20) seen++;
      offset++;
    }

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: offset),
    );
  }
}

/// The phone entry field: a fixed `+92` and the national number beside it.
class PakistanPhoneField extends StatelessWidget {
  const PakistanPhoneField({
    required this.controller,
    required this.onSubmitted,
    this.errorText,
    this.enabled = true,
    super.key,
  });

  final TextEditingController controller;
  final VoidCallback onSubmitted;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceRaised,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: errorText == null
                  ? AppColors.cardBorder
                  : AppColors.electricRose,
            ),
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 12, 0),
                child: Text(
                  pakistanDialCode,
                  style: textTheme.titleMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Container(width: 1, height: 28, color: AppColors.cardBorder),
              Expanded(
                child: TextField(
                  controller: controller,
                  enabled: enabled,
                  autofocus: true,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => onSubmitted(),
                  inputFormatters: const [PakistanPhoneInputFormatter()],
                  style: textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                  decoration: InputDecoration(
                    hintText: '300 1234567',
                    hintStyle: textTheme.titleMedium?.copyWith(
                      color: AppColors.textTertiary,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 16,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 8),
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
                  errorText!,
                  style: textTheme.bodySmall?.copyWith(
                    color: AppColors.electricRose,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
