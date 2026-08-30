import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:preload_page_view/preload_page_view.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/pkr.dart';
import '../../domain/feed_item.dart';
import '../feed_controller.dart';
import '../widgets/bolo_voice_button.dart';
import '../widgets/feed_video_page.dart';
import '../widgets/interaction_column.dart';
import '../widgets/live_badge.dart';
import '../widgets/product_overlay_card.dart';

/// The home screen: a full-bleed vertical video feed.
///
/// One product fills the screen, you flick up for the next. The chrome — live
/// badge, voice button, interaction rail, product card — floats over the video
/// rather than taking layout from it, because on a 5-inch phone every pixel
/// spent on a frame is a pixel not spent on the thing being sold.
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  static const routeName = '/';

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final PreloadPageController _pageController = PreloadPageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _showSoon(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: AppColors.surfaceRaised,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          duration: const Duration(seconds: 2),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedControllerProvider);
    final controller = ref.read(feedControllerProvider.notifier);
    final items = state.items;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.immersiveOverlay,
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        // The feed runs edge to edge, under the status bar and the gesture bar.
        extendBody: true,
        extendBodyBehindAppBar: true,
        body: items.isEmpty
            ? const _EmptyFeed()
            : Stack(
                children: [
                  // preloadPagesCount: 1 builds one page either side, so the
                  // next video has begun buffering by the time a thumb lands on
                  // it. Two would buffer more aggressively than a Pakistani
                  // mobile data bundle deserves.
                  PreloadPageView.builder(
                    controller: _pageController,
                    scrollDirection: Axis.vertical,
                    preloadPagesCount: 1,
                    itemCount: items.length,
                    onPageChanged: controller.onPageChanged,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return _FeedPage(
                        item: item,
                        pageIndex: index,
                        isActive: index == state.currentIndex,
                        onLike: () => controller.toggleLike(item.id),
                        onFollow: () => controller.toggleFollow(item.id),
                        onComment: () => _showSoon('Comments are coming soon.'),
                        onShare: () => _showSoon('Shared to WhatsApp.'),
                        onSoloBuy: () => _showSoon(
                          'Solo buy — ${formatPkr(item.soloPricePkr)}, cash on delivery.',
                        ),
                        onTeamBuy: () => _showSoon(
                          'Team buy — invite one friend within 24 hours to unlock '
                          '${formatPkr(item.teamPricePkr)}.',
                        ),
                      );
                    },
                  ),
                  _TopBar(
                    item: state.current,
                    onBolo: () => _showSoon('Bolo — say what you are looking for.'),
                  ),
                  if (state.errorMessage != null)
                    _OfflineNotice(message: state.errorMessage!),
                ],
              ),
      ),
    );
  }
}

/// One page: video, scrims, interaction rail, product card.
class _FeedPage extends StatelessWidget {
  const _FeedPage({
    required this.item,
    required this.pageIndex,
    required this.isActive,
    required this.onLike,
    required this.onFollow,
    required this.onComment,
    required this.onShare,
    required this.onSoloBuy,
    required this.onTeamBuy,
  });

  final FeedItem item;
  final int pageIndex;
  final bool isActive;
  final VoidCallback onLike;
  final VoidCallback onFollow;
  final VoidCallback onComment;
  final VoidCallback onShare;
  final VoidCallback onSoloBuy;
  final VoidCallback onTeamBuy;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

    return Stack(
      fit: StackFit.expand,
      children: [
        FeedVideoPage(item: item, isActive: isActive, pageIndex: pageIndex),

        // Scrims. Without them, white text over a bright lawn print is
        // unreadable exactly when the product photographs best.
        const IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: AppColors.topScrimGradient),
            child: SizedBox(height: 220, width: double.infinity),
          ),
        ),
        const IgnorePointer(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: DecoratedBox(
              decoration: BoxDecoration(gradient: AppColors.bottomScrimGradient),
              child: SizedBox(height: 380, width: double.infinity),
            ),
          ),
        ),

        // The rail and the card are one bottom-anchored column rather than two
        // independently positioned layers. A fixed offset for the rail would
        // have to guess the card's height, and the card grows with a two-line
        // title, a long spec list, or a large accessibility text scale — at
        // which point the guess is wrong and the share button lands on top of
        // the price.
        Positioned(
          left: 12,
          right: 12,
          bottom: bottomInset + 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              InteractionColumn(
                item: item,
                onLike: onLike,
                onComment: onComment,
                onShare: onShare,
                onFollow: onFollow,
              ),
              const SizedBox(height: 18),
              ProductOverlayCard(
                item: item,
                onSoloBuy: onSoloBuy,
                onTeamBuy: onTeamBuy,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The floating top bar: live badge on the left, Bolo on the right.
class _TopBar extends StatelessWidget {
  const _TopBar({required this.item, required this.onBolo});

  final FeedItem? item;
  final VoidCallback onBolo;

  @override
  Widget build(BuildContext context) {
    final isLive = item?.isLive ?? false;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
        child: Row(
          children: [
            if (isLive) LiveBadge(viewerCount: item!.liveViewerCount),
            const Spacer(),
            BoloVoiceButton(onPressed: onBolo),
          ],
        ),
      ),
    );
  }
}

/// Shown when the feed is sample content because the gateway was unreachable.
/// Saying so beats letting someone believe four hardcoded products are the
/// whole catalog.
class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Align(
        alignment: Alignment.topCenter,
        // Horizontal padding is what bounds the pill: the message is a whole
        // sentence, and an unbounded min-width Row overflows every phone.
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 56, 16, 0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.cardOverlay,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
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

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.primaryGreen),
    );
  }
}
