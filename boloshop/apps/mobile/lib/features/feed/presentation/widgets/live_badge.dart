import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/feed_item.dart';

/// The "LIVE 🟢 1.2k" badge in the top bar.
///
/// The dot pulses rather than blinking. A blink is a notification — it demands
/// a decision; a slow pulse reads as a heartbeat, which is what "this is
/// happening right now" should feel like next to a video that is already
/// moving.
class LiveBadge extends StatefulWidget {
  const LiveBadge({required this.viewerCount, super.key});

  final int viewerCount;

  @override
  State<LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<LiveBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  late final Animation<double> _pulse = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeInOut,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.electricRose,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: AppColors.electricRose.withValues(alpha: 0.35),
            blurRadius: 12,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'LIVE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  height: 1,
                ),
          ),
          const SizedBox(width: 6),
          AnimatedBuilder(
            animation: _pulse,
            builder: (context, child) {
              return Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.liveDot,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.liveDot
                          .withValues(alpha: 0.2 + 0.6 * _pulse.value),
                      blurRadius: 4 + 8 * _pulse.value,
                      spreadRadius: 1 + 3 * _pulse.value,
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(width: 6),
          Text(
            formatCount(widget.viewerCount),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                  height: 1,
                ),
          ),
        ],
      ),
    );
  }
}
