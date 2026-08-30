import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../voice/domain/voice_filter.dart';
import '../data/feed_repository.dart';
import '../domain/feed_item.dart';

/// The feed's state: the pages, and which one is on screen.
class FeedState {
  const FeedState({
    required this.items,
    this.currentIndex = 0,
    this.isLoading = false,
    this.errorMessage,
    this.filters = const <VoiceFilter>{},
    this.transcript,
  });

  /// Everything the feed has loaded, before filtering.
  final List<FeedItem> items;
  final int currentIndex;
  final bool isLoading;

  /// Filters applied from a Bolo voice search. Empty means the whole feed.
  final Set<VoiceFilter> filters;

  /// What Bolo heard, kept so the UI can show why the feed is narrowed.
  final String? transcript;

  /// Set when the feed fell back to sample content, so the UI can say so
  /// instead of silently pretending the network worked.
  final String? errorMessage;

  /// What is actually on screen once the filters are applied.
  List<FeedItem> get visibleItems => applyFilters(items, filters);

  /// True when filters are on but nothing survives them — a real state the
  /// feed has to render, not an error.
  bool get isFilteredEmpty => filters.isNotEmpty && visibleItems.isEmpty;

  FeedItem? get current {
    final visible = visibleItems;
    return currentIndex >= 0 && currentIndex < visible.length
        ? visible[currentIndex]
        : null;
  }

  FeedState copyWith({
    List<FeedItem>? items,
    int? currentIndex,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    Set<VoiceFilter>? filters,
    String? transcript,
    bool clearTranscript = false,
  }) => FeedState(
    items: items ?? this.items,
    currentIndex: currentIndex ?? this.currentIndex,
    isLoading: isLoading ?? this.isLoading,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    filters: filters ?? this.filters,
    transcript: clearTranscript ? null : (transcript ?? this.transcript),
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
        // Filters survive a refresh: a buyer who narrowed to lawn suits did
        // not ask for the whole catalog back.
        filters: state.filters,
        transcript: state.transcript,
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

  /// Replaces the active filter set from a Bolo search.
  ///
  /// The index resets to zero: after the feed narrows, whatever was page four
  /// is a different product, and leaving the viewer there would look like the
  /// app jumped.
  void applyVoiceFilters(Set<VoiceFilter> filters, {String? transcript}) {
    state = state.copyWith(
      filters: filters,
      currentIndex: 0,
      transcript: transcript,
      clearTranscript: transcript == null,
    );
  }

  /// Turns one chip on or off, keeping the rest.
  void toggleFilter(VoiceFilter filter) {
    final next = Set<VoiceFilter>.from(state.filters);
    if (!next.remove(filter)) next.add(filter);
    state = state.copyWith(filters: next, currentIndex: 0);
  }

  void clearFilters() {
    state = state.copyWith(
      filters: const <VoiceFilter>{},
      currentIndex: 0,
      clearTranscript: true,
    );
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

final feedControllerProvider = NotifierProvider<FeedController, FeedState>(
  FeedController.new,
);
