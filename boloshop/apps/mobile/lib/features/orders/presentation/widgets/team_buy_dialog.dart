import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/pkr.dart';
import '../../domain/order_models.dart';

/// Shown once a team purchase exists: the link, how long it lasts, and the one
/// button that matters.
///
/// The order is already placed at this point — the discount only lands when a
/// friend joins — so the copy says that plainly rather than implying the
/// cheaper price is already secured.
class TeamBuyDialog extends StatelessWidget {
  const TeamBuyDialog({
    required this.teamPurchase,
    required this.order,
    required this.productTitle,
    required this.onShare,
    super.key,
  });

  final TeamPurchase teamPurchase;
  final PlacedOrder order;
  final String productTitle;

  /// Opens WhatsApp's contact picker with the invitation ready to send.
  final Future<bool> Function() onShare;

  static Future<void> show(
    BuildContext context, {
    required TeamPurchase teamPurchase,
    required PlacedOrder order,
    required String productTitle,
    required Future<bool> Function() onShare,
  }) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.65),
      builder: (context) => TeamBuyDialog(
        teamPurchase: teamPurchase,
        order: order,
        productTitle: productTitle,
        onShare: onShare,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Dialog(
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      // Scrollable, and bounded to the viewport: the title can run to two
      // lines, the copy is fixed, and a buyer at a large accessibility text
      // scale on a short phone would otherwise get a striped overflow bar
      // where the share button should be.
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Text('⚡', style: TextStyle(fontSize: 20, height: 1)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Team buy started',
                        style: textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    _CountdownPill(
                      expiresAt: teamPurchase.expiresAt,
                      windowHours: teamPurchase.windowHours,
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                Text(
                  productTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 16),

                _OrderSummary(order: order, teamPurchase: teamPurchase),
                const SizedBox(height: 16),

                _ShareLinkRow(shareUrl: teamPurchase.shareUrl),
                const SizedBox(height: 8),

                Text(
                  'One friend has to join within ${teamPurchase.windowHours} hours. '
                  'The discount comes off your order the moment they do.',
                  style: textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 18),

                _ShareButton(onShare: onShare),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    'Later',
                    style: textTheme.labelLarge?.copyWith(
                      color: AppColors.textTertiary,
                    ),
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

/// Order reference, what was charged, and what the discount would make it.
class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.order, required this.teamPurchase});

  final PlacedOrder order;
  final TeamPurchase teamPurchase;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          _SummaryRow(
            label: 'Order',
            value: order.shortId,
            valueColor: AppColors.textPrimary,
          ),
          const SizedBox(height: 8),
          _SummaryRow(
            label: 'Total now',
            value: formatPkr(order.totalAmountPkr),
            valueColor: AppColors.textPrimary,
          ),
          const SizedBox(height: 8),
          _SummaryRow(
            label: 'If your friend joins',
            value: '−${teamPurchase.discountPctRounded}%',
            valueColor: AppColors.electricRose,
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: textTheme.bodyMedium?.copyWith(
            color: valueColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

/// The link, with a copy button — not everyone shares through WhatsApp.
class _ShareLinkRow extends StatelessWidget {
  const _ShareLinkRow({required this.shareUrl});

  final String shareUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
      decoration: BoxDecoration(
        color: AppColors.darkBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              shareUrl,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                letterSpacing: 0.2,
              ),
            ),
          ),
          IconButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: shareUrl));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  const SnackBar(
                    content: Text('Link copied'),
                    behavior: SnackBarBehavior.floating,
                    duration: Duration(seconds: 2),
                  ),
                );
            },
            icon: const Icon(Icons.copy_rounded, size: 18),
            color: AppColors.textSecondary,
            tooltip: 'Copy link',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _ShareButton extends StatefulWidget {
  const _ShareButton({required this.onShare});

  final Future<bool> Function() onShare;

  @override
  State<_ShareButton> createState() => _ShareButtonState();
}

class _ShareButtonState extends State<_ShareButton> {
  bool _isSharing = false;

  Future<void> _share() async {
    setState(() => _isSharing = true);
    final opened = await widget.onShare();
    if (!mounted) return;
    setState(() => _isSharing = false);

    if (opened) {
      Navigator.of(context).pop();
      return;
    }

    // The link is still on screen and still copyable, so say what failed
    // rather than closing the one place it can be retrieved from.
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Could not open WhatsApp. Copy the link instead.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: _isSharing ? null : _share,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.whatsApp,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Center(
              child: _isSharing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.share, size: 18, color: Colors.white),
                        const SizedBox(width: 8),
                        Text(
                          'Invite a friend on WhatsApp',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// How long is left on the join window.
class _CountdownPill extends StatelessWidget {
  const _CountdownPill({required this.expiresAt, required this.windowHours});

  final DateTime? expiresAt;
  final int windowHours;

  @override
  Widget build(BuildContext context) {
    final remaining = expiresAt?.difference(DateTime.now());

    // Falls back to the configured window rather than showing a wrong number
    // if the timestamp did not parse.
    final label = remaining == null || remaining.isNegative
        ? '${windowHours}h'
        : remaining.inMinutes >= 60
        // Rounded, not truncated: inHours on 22h59m gives 22, which tells a
        // buyer they have an hour less than they actually do.
        ? '${(remaining.inMinutes / 60).round()}h left'
        : '${remaining.inMinutes}m left';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.electricRose.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: AppColors.electricRose.withValues(alpha: 0.4),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppColors.electricRose,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
