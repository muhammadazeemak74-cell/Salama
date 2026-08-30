import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:preload_page_view/preload_page_view.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/pkr.dart';
import '../../../orders/presentation/order_actions.dart';
import '../../../orders/presentation/widgets/team_buy_dialog.dart';
import '../../../voice/domain/voice_filter.dart';
import '../../../voice/presentation/widgets/voice_search_modal.dart';
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

  void _notify(String message, {bool isError = false, Duration? duration}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: isError
              ? AppColors.electricRoseDeep
              : AppColors.surfaceRaised,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          duration: duration ?? const Duration(seconds: 3),
        ),
      );
  }

  void _showSoon(String message) => _notify(message);

  /// Turns a buy result into something the person sees.
  ///
  /// Every branch of [BuyOutcome] is handled here, including the ones that
  /// succeeded partially: an order that was placed but could not open WhatsApp
  /// still exists, and saying nothing would leave a buyer thinking it failed.
  Future<void> _handleOutcome(BuyOutcome outcome, FeedItem item) async {
    switch (outcome) {
      case BuyAlreadyInProgress():
        // A second tap while the first order is in flight. Silence is correct:
        // the button is already working.
        return;

      case BuyNeedsSignIn():
        _notify(
          'Sign in to place an order. (No auth flow yet — run with '
          '--dart-define=DEMO_BUYER_ID=<uuid>.)',
          isError: true,
          duration: const Duration(seconds: 5),
        );

      case BuyFailed(:final message):
        _notify(message, isError: true, duration: const Duration(seconds: 4));

      case SoloBuyPlaced(:final order, :final whatsAppOpened):
        _notify(
          whatsAppOpened
              ? 'Order ${order.shortId} placed — confirm with ${order.storeName} '
                    'on WhatsApp.'
              : 'Order ${order.shortId} placed for ${formatPkr(order.totalAmountPkr)} '
                    '(COD). WhatsApp could not be opened on this device.',
          duration: const Duration(seconds: 4),
        );

      case TeamBuyOpened(:final order, :final teamPurchase):
        if (!mounted) return;
        await TeamBuyDialog.show(
          context,
          teamPurchase: teamPurchase,
          order: order,
          productTitle: item.productTitle,
          onShare: () => ref
              .read(orderActionsProvider.notifier)
              .shareTeamInvite(teamPurchase: teamPurchase, item: item),
        );
    }
  }

  Future<void> _soloBuy(FeedItem item) async {
    final outcome = await ref.read(orderActionsProvider.notifier).soloBuy(item);
    await _handleOutcome(outcome, item);
  }

  Future<void> _teamBuy(FeedItem item) async {
    final outcome = await ref.read(orderActionsProvider.notifier).teamBuy(item);
    await _handleOutcome(outcome, item);
  }

  /// Opens the Bolo sheet and applies whatever filters come back.
  Future<void> _openVoiceSearch() async {
    final controller = ref.read(feedControllerProvider.notifier);
    final result = await VoiceSearchModal.show(
      context,
      initialFilters: ref.read(feedControllerProvider).filters,
    );
    if (result == null) return;

    controller.applyVoiceFilters(
      result.filters,
      transcript: result.filters.isEmpty ? null : result.transcript,
    );

    // The feed rebuilt around a different list, so the page view has to go
    // back to the top with it — otherwise it keeps a scroll offset that now
    // points at a different product.
    if (_pageController.hasClients) {
      _pageController.jumpToPage(0);
    }

    if (!mounted) return;
    final count = ref.read(feedControllerProvider).visibleItems.length;
    _notify(
      result.filters.isEmpty
          ? 'Showing everything.'
          : '$count product${count == 1 ? '' : 's'} match “${result.transcript}”.',
    );
  }

  void _clearFilters() {
    ref.read(feedControllerProvider.notifier).clearFilters();
    if (_pageController.hasClients) _pageController.jumpToPage(0);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedControllerProvider);
    final controller = ref.read(feedControllerProvider.notifier);
    // What survives the Bolo filters, which is what the page view scrolls.
    final items = state.visibleItems;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.immersiveOverlay,
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        // The feed runs edge to edge, under the status bar and the gesture bar.
        extendBody: true,
        extendBodyBehindAppBar: true,
        body: items.isEmpty
            ? (state.isFilteredEmpty
                  ? _NoMatches(
                      transcript: state.transcript,
                      onClear: _clearFilters,
                      onRetryVoice: _openVoiceSearch,
                    )
                  : const _EmptyFeed())
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
                        onSoloBuy: () => _soloBuy(item),
                        onTeamBuy: () => _teamBuy(item),
                      );
                    },
                  ),
                  _TopBar(item: state.current, onBolo: _openVoiceSearch),
                  if (state.filters.isNotEmpty)
                    _ActiveFilterBar(
                      filters: state.filters,
                      transcript: state.transcript,
                      matchCount: items.length,
                      onClear: _clearFilters,
                    )
                  else if (state.errorMessage != null)
                    _OfflineNotice(message: state.errorMessage!),
                  // A cash-on-delivery order is being created; block the feed
                  // so a second tap cannot land on a different product.
                  if (ref.watch(orderActionsProvider)) const _BuyBlocker(),
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
              decoration: BoxDecoration(
                gradient: AppColors.bottomScrimGradient,
              ),
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
                const Icon(
                  Icons.cloud_off_rounded,
                  size: 14,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall
                        ?.copyWith(color: AppColors.textSecondary),
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

/// The bar under the status bar when Bolo has narrowed the feed.
///
/// It replaces the offline notice rather than stacking with it: two pills in
/// the same spot would cover the video, and the filters are the more urgent
/// thing to be able to undo.
class _ActiveFilterBar extends StatelessWidget {
  const _ActiveFilterBar({
    required this.filters,
    required this.transcript,
    required this.matchCount,
    required this.onClear,
  });

  final Set<VoiceFilter> filters;
  final String? transcript;
  final int matchCount;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 56, 14, 0),
        child: Align(
          alignment: Alignment.topCenter,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            decoration: BoxDecoration(
              color: AppColors.cardOverlay,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      '🎙️',
                      style: TextStyle(fontSize: 12, height: 1),
                    ),
                    const SizedBox(width: 6),
                    // The transcript alone on this line. Pairing it with the
                    // match count here cost the count to an ellipsis on a
                    // 360dp phone, so the count moved to the chip row.
                    Flexible(
                      child: Text(
                        transcript == null ? 'Filtered' : '“$transcript”',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.labelMedium?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Semantics(
                      button: true,
                      label: 'Clear filters',
                      child: GestureDetector(
                        onTap: onClear,
                        behavior: HitTestBehavior.opaque,
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '$matchCount match${matchCount == 1 ? '' : 'es'}',
                      style: textTheme.labelSmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    for (final filter in filters)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: AppColors.primaryGreen.withValues(
                              alpha: 0.5,
                            ),
                          ),
                        ),
                        child: Text(
                          filter.label,
                          style: textTheme.labelSmall?.copyWith(
                            color: AppColors.primaryGreen,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Filters are on and nothing matched. Not an error — a dead end the buyer
/// needs a way out of, so both exits are on screen.
class _NoMatches extends StatelessWidget {
  const _NoMatches({
    required this.transcript,
    required this.onClear,
    required this.onRetryVoice,
  });

  final String? transcript;
  final VoidCallback onClear;
  final VoidCallback onRetryVoice;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.search_off_rounded,
              size: 46,
              color: AppColors.textTertiary,
            ),
            const SizedBox(height: 16),
            Text(
              transcript == null
                  ? 'Nothing matches those filters'
                  : 'Nothing matches “$transcript”',
              textAlign: TextAlign.center,
              style: textTheme.titleMedium?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Try fewer filters, or say it again.',
              textAlign: TextAlign.center,
              style: textTheme.bodySmall?.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 22),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton(
                  onPressed: onClear,
                  child: const Text('Show everything'),
                ),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: onRetryVoice,
                  icon: const Text('🎙️', style: TextStyle(fontSize: 13)),
                  label: const Text('Bolo'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Covers the feed while an order is being created, so a second tap cannot
/// land on a different product's buy button mid-request.
class _BuyBlocker extends StatelessWidget {
  const _BuyBlocker();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.45),
        child: const Center(
          child: SizedBox(
            width: 34,
            height: 34,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.primaryGreen,
            ),
          ),
        ),
      ),
    );
  }
}
