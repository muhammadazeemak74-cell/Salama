import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/feed_item.dart';

/// The right-hand rail: seller, like, comments, WhatsApp share.
///
/// Everything here is thumb-reachable on the right edge, which is where a
/// one-handed grip puts it. Counts sit under their icon rather than beside it
/// so the column stays narrow and the video stays visible.
class InteractionColumn extends StatelessWidget {
  const InteractionColumn({
    required this.item,
    required this.onLike,
    required this.onComment,
    required this.onShare,
    required this.onFollow,
    super.key,
  });

  final FeedItem item;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onShare;
  final VoidCallback onFollow;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _SellerAvatar(
          storeName: item.storeName,
          isFollowing: item.isFollowing,
          onFollow: onFollow,
        ),
        const SizedBox(height: 22),
        _LikeButton(
          isLiked: item.isLiked,
          count: item.likeCount,
          onPressed: onLike,
        ),
        const SizedBox(height: 18),
        _RailAction(
          icon: Icons.mode_comment_outlined,
          label: formatCount(item.commentCount),
          onPressed: onComment,
          semanticLabel: '${item.commentCount} comments',
        ),
        const SizedBox(height: 18),
        _WhatsAppShareButton(onPressed: onShare),
      ],
    );
  }
}

/// The merchant's avatar with a follow affordance hanging off the bottom.
class _SellerAvatar extends StatelessWidget {
  const _SellerAvatar({
    required this.storeName,
    required this.isFollowing,
    required this.onFollow,
  });

  final String storeName;
  final bool isFollowing;
  final VoidCallback onFollow;

  /// Store initials, so a seller with no uploaded logo still gets an identity
  /// instead of a grey silhouette.
  String get _initials {
    final words = storeName.trim().split(RegExp(r'\s+'));
    if (words.isEmpty || words.first.isEmpty) return '?';
    if (words.length == 1) return words.first.characters.first.toUpperCase();
    return (words[0].characters.first + words[1].characters.first).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 52,
      height: 62,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.soloBuyGradient,
              border: Border.all(color: AppColors.textPrimary, width: 2),
            ),
            alignment: Alignment.center,
            child: Text(
              _initials,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          Positioned(
            bottom: 0,
            child: Semantics(
              button: true,
              label: isFollowing ? 'Following $storeName' : 'Follow $storeName',
              child: GestureDetector(
                onTap: onFollow,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: isFollowing ? AppColors.surfaceRaised : AppColors.electricRose,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.darkBackground, width: 2),
                  ),
                  child: Icon(
                    isFollowing ? Icons.check : Icons.add,
                    size: 13,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The heart. It scales up on tap so a like feels like it landed even before
/// the request completes.
class _LikeButton extends StatefulWidget {
  const _LikeButton({
    required this.isLiked,
    required this.count,
    required this.onPressed,
  });

  final bool isLiked;
  final int count;
  final VoidCallback onPressed;

  @override
  State<_LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<_LikeButton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );

  late final Animation<double> _scale = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 1, end: 1.35), weight: 40),
    TweenSequenceItem(tween: Tween(begin: 1.35, end: 1), weight: 60),
  ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    _controller.forward(from: 0);
    widget.onPressed();
  }

  @override
  Widget build(BuildContext context) {
    return _RailAction(
      icon: widget.isLiked ? Icons.favorite : Icons.favorite_border,
      iconColor: widget.isLiked ? AppColors.electricRose : AppColors.textPrimary,
      label: formatCount(widget.count),
      onPressed: _handleTap,
      scale: _scale,
      semanticLabel: widget.isLiked ? 'Unlike' : 'Like',
    );
  }
}

/// The WhatsApp share. One tap, no share sheet: on a Pakistani phone the share
/// target is WhatsApp essentially every time, and the extra sheet is a step
/// between a buyer and their group chat.
class _WhatsAppShareButton extends StatelessWidget {
  const _WhatsAppShareButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Share on WhatsApp',
      child: GestureDetector(
        onTap: onPressed,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.whatsApp,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.whatsApp.withValues(alpha: 0.35),
                    blurRadius: 12,
                  ),
                ],
              ),
              // Icons.share is the honest stock stand-in; swap for the
              // WhatsApp glyph asset once brand assets are in the repo.
              child: const Icon(Icons.share, size: 21, color: Colors.white),
            ),
            const SizedBox(height: 6),
            Text(
              'Share',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    shadows: const [Shadow(blurRadius: 4, color: Colors.black54)],
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One icon-over-label entry in the rail.
class _RailAction extends StatelessWidget {
  const _RailAction({
    required this.icon,
    required this.label,
    required this.onPressed,
    required this.semanticLabel,
    this.iconColor,
    this.scale,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final String semanticLabel;
  final Color? iconColor;
  final Animation<double>? scale;

  @override
  Widget build(BuildContext context) {
    final glyph = Icon(
      icon,
      size: 33,
      color: iconColor ?? AppColors.textPrimary,
      shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
    );

    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        onTap: onPressed,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (scale != null) ScaleTransition(scale: scale!, child: glyph) else glyph,
            const SizedBox(height: 5),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    shadows: const [Shadow(blurRadius: 4, color: Colors.black54)],
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
