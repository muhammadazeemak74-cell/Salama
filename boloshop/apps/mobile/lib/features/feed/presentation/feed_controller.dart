import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/feed_repository.dart';
import '../domain/feed_item.dart';

/// The feed's state: the pages, and which one is on screen.
class FeedState {
  const FeedState({
    required this.items,
    this.currentIndex = 0,
    this.isLoading = false,
    this.errorMessage,
  });

  final List<FeedItem> items;
  final int currentIndex;
  final bool isLoading;

  /// Set when the feed fell back to sample content, so the UI can say so
  /// instead of silently pretending the network worked.
  final String? errorMessage;

  FeedItem? get current =>
      currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : null;

  FeedState copyWith({
    List<FeedItem>? items,
    int? currentIndex,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      FeedState(
        items: items ?? this.items,
        currentIndex: currentIndex ?? this.currentIndex,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

/// Owns the feed. Likes are applied optimistically — the person tapping a
/// heart on a moving train should not wait for a round trip to see it fill.
class FeedController extends Notifier<FeedState> {
  @override
  FeedState build() {
    // Start on the sample content so the first frame is never empty, then
    // replace it with the real feed once the gateway answers.
    Future<void>.microtask(refresh);
    return const FeedState(items: sampleFeed, isLoading: true);
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final items = await ref.read(feedRepositoryProvider).fetchFeed();
      state = FeedState(
        // An empty catalog is not a reason to show an empty screen during
        // development; keep the samples and say nothing.
        items: items.isEmpty ? sampleFeed : items,
        currentIndex: 0,
      );
    } on Object {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Showing sample products — could not reach BoloShop.',
      );
    }
  }

  void onPageChanged(int index) {
    if (index == state.currentIndex) return;
    state = state.copyWith(currentIndex: index);
  }

  /// Toggles the like on one item.
  void toggleLike(String itemId) {
    state = state.copyWith(
      items: [
        for (final item in state.items)
          if (item.id == itemId)
            item.copyWith(
              isLiked: !item.isLiked,
              likeCount: item.likeCount + (item.isLiked ? -1 : 1),
            )
          else
            item,
      ],
    );
  }

  void toggleFollow(String itemId) {
    state = state.copyWith(
      items: [
        for (final item in state.items)
          if (item.id == itemId)
            item.copyWith(isFollowing: !item.isFollowing)
          else
            item,
      ],
    );
  }
}

final feedControllerProvider =
    NotifierProvider<FeedController, FeedState>(FeedController.new);
