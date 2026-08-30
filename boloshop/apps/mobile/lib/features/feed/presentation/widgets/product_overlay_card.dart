import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/pkr.dart';
import '../../domain/feed_item.dart';

/// The product card over the bottom of the video, and the dual call to action
/// under it.
///
/// The two buttons are the whole business model, so they are given equal
/// weight and different colours rather than a primary and a ghost: solo buy is
/// green and certain, team buy is rose and cheaper. Making team buy visibly
/// louder is deliberate — it is the growth loop.
class ProductOverlayCard extends StatelessWidget {
  const ProductOverlayCard({
    required this.item,
    required this.onSoloBuy,
    required this.onTeamBuy,
    super.key,
  });

  final FeedItem item;
  final VoidCallback onSoloBuy;
  final VoidCallback onTeamBuy;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final savings = savingPercent(
      from: item.soloPricePkr,
      to: item.teamPricePkr,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
          decoration: BoxDecoration(
            color: AppColors.cardOverlay,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      item.sellerHandle.isEmpty
                          ? item.storeName
                          : item.sellerHandle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (item.city.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Text('•', style: TextStyle(color: AppColors.textTertiary)),
                    const SizedBox(width: 6),
                    Text(
                      item.city,
                      style: textTheme.labelMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item.productTitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                  height: 1.25,
                ),
              ),
              if (item.fabricSpecs.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  item.fabricSpecs,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  // The price pair takes what is left after the COD chip and
                  // ellipsises rather than overflowing: a six-figure rupee
                  // total at a large accessibility text scale is wider than a
                  // phone, and a striped overflow bar is not a price tag.
                  Expanded(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(
                            formatPkr(item.teamPricePkr),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.headlineSmall?.copyWith(
                              color: AppColors.primaryGreen,
                              fontWeight: FontWeight.w800,
                              height: 1,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            formatPkr(item.soloPricePkr),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.bodyMedium?.copyWith(
                              color: AppColors.textTertiary,
                              decoration: TextDecoration.lineThrough,
                              decorationColor: AppColors.textTertiary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const _CodChip(),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _DualCtaBar(
          soloPricePkr: item.soloPricePkr,
          teamPricePkr: item.teamPricePkr,
          savingPercent: savings,
          onSoloBuy: onSoloBuy,
          onTeamBuy: onTeamBuy,
        ),
      ],
    );
  }
}

/// Cash on delivery is the reason most of this market buys online at all, so
/// it is stated on the card rather than discovered at checkout.
class _CodChip extends StatelessWidget {
  const _CodChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.cardOverlaySoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.payments_outlined,
            size: 13,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: 4),
          Text(
            'COD',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// [Solo Buy: ₨ 3,500]  [⚡ Team Buy: ₨ 2,450 (Save 30%)]
class _DualCtaBar extends StatelessWidget {
  const _DualCtaBar({
    required this.soloPricePkr,
    required this.teamPricePkr,
    required this.savingPercent,
    required this.onSoloBuy,
    required this.onTeamBuy,
  });

  final String soloPricePkr;
  final String teamPricePkr;
  final int? savingPercent;
  final VoidCallback onSoloBuy;
  final VoidCallback onTeamBuy;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          flex: 4,
          child: _CtaButton(
            gradient: AppColors.soloBuyGradient,
            foreground: Colors.black,
            title: 'Solo Buy',
            price: formatPkr(soloPricePkr),
            onPressed: onSoloBuy,
            semanticLabel: 'Buy alone for ${formatPkr(soloPricePkr)}',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          // Wider, because it carries a third line of information and because
          // it is the option the business wants taken.
          flex: 5,
          child: _CtaButton(
            gradient: AppColors.teamBuyGradient,
            foreground: Colors.white,
            leading: '⚡',
            title: 'Team Buy',
            price: formatPkr(teamPricePkr),
            footnote: savingPercent == null ? null : 'Save $savingPercent%',
            onPressed: onTeamBuy,
            semanticLabel: savingPercent == null
                ? 'Team buy for ${formatPkr(teamPricePkr)}'
                : 'Team buy for ${formatPkr(teamPricePkr)}, saving $savingPercent percent',
          ),
        ),
      ],
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({
    required this.gradient,
    required this.foreground,
    required this.title,
    required this.price,
    required this.onPressed,
    required this.semanticLabel,
    this.leading,
    this.footnote,
  });

  final LinearGradient gradient;
  final Color foreground;
  final String title;
  final String price;
  final VoidCallback onPressed;
  final String semanticLabel;
  final String? leading;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      button: true,
      label: semanticLabel,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: gradient.colors.first.withValues(alpha: 0.3),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (leading != null) ...[
                        Text(
                          leading!,
                          style: const TextStyle(fontSize: 13, height: 1),
                        ),
                        const SizedBox(width: 4),
                      ],
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textTheme.labelMedium?.copyWith(
                            color: foreground,
                            fontWeight: FontWeight.w700,
                            height: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      price,
                      maxLines: 1,
                      style: textTheme.titleMedium?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                  ),
                  if (footnote != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      footnote!,
                      maxLines: 1,
                      style: textTheme.labelSmall?.copyWith(
                        color: foreground.withValues(alpha: 0.85),
                        fontWeight: FontWeight.w600,
                        height: 1,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
