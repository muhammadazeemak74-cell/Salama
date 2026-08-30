import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/feed_item.dart';

/// The video surface behind one feed page.
///
/// Only the page on screen holds a decoder. Video decoders are a scarce
/// hardware resource, and the mid-range Androids this app targets will drop
/// frames or fail to initialise if a handful of pages each keep one alive.
/// [preload_page_view] builds the neighbours ahead of time; this widget makes
/// sure only the active one is actually playing.
///
/// A page whose seller has no rendered video yet — media-service may still be
/// working on it — shows a branded poster rather than a black rectangle.
class FeedVideoPage extends StatefulWidget {
  const FeedVideoPage({
    required this.item,
    required this.isActive,
    required this.pageIndex,
    super.key,
  });

  final FeedItem item;
  final bool isActive;
  final int pageIndex;

  @override
  State<FeedVideoPage> createState() => _FeedVideoPageState();
}

class _FeedVideoPageState extends State<FeedVideoPage> {
  VideoPlayerController? _controller;
  bool _isInitialising = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _attach();
  }

  @override
  void didUpdateWidget(FeedVideoPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive == oldWidget.isActive) return;

    if (widget.isActive) {
      _attach();
    } else {
      _detach();
    }
  }

  @override
  void dispose() {
    _detach();
    super.dispose();
  }

  Future<void> _attach() async {
    final url = widget.item.hlsStreamUrl;
    if (url == null || url.isEmpty || _controller != null || _isInitialising) return;

    setState(() {
      _isInitialising = true;
      _failed = false;
    });

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));

    try {
      await controller.initialize();
      // The page may have scrolled away while we were initialising.
      if (!mounted || !widget.isActive) {
        await controller.dispose();
        return;
      }

      await controller.setLooping(true);
      // Muted autoplay: a feed that shouts when it opens gets closed. The
      // viewer unmutes by tapping.
      await controller.setVolume(0);
      await controller.play();

      setState(() {
        _controller = controller;
        _isInitialising = false;
      });
    } on Object {
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _isInitialising = false;
        _failed = true;
      });
    }
  }

  void _detach() {
    final controller = _controller;
    _controller = null;
    _isInitialising = false;
    // Release the decoder immediately; awaiting would hold it past the frame.
    if (controller != null) {
      unawaited(controller.pause().then((_) => controller.dispose()));
    }
  }

  void _togglePlayback() {
    final controller = _controller;
    if (controller == null) return;

    unawaited(controller.value.isPlaying ? controller.pause() : controller.play());
    // Rebuild so any play/pause affordance reflects the new state.
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    return GestureDetector(
      onTap: _togglePlayback,
      child: ColoredBox(
        color: AppColors.darkBackground,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (controller != null && controller.value.isInitialized)
              // Cover the frame: a 9:16 feed letterboxing a 4:3 clip wastes
              // the only screen the buyer has.
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: controller.value.size.width,
                  height: controller.value.size.height,
                  child: VideoPlayer(controller),
                ),
              )
            else
              _Poster(item: widget.item, pageIndex: widget.pageIndex, failed: _failed),
            if (_isInitialising)
              const Center(
                child: SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primaryGreen,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// What a page shows before — or instead of — its video.
class _Poster extends StatelessWidget {
  const _Poster({required this.item, required this.pageIndex, required this.failed});

  final FeedItem item;
  final int pageIndex;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: AppColors.posterGradient(pageIndex)),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              failed ? Icons.wifi_off_rounded : Icons.play_circle_outline_rounded,
              size: 58,
              color: AppColors.textPrimary.withValues(alpha: 0.28),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48),
              child: Text(
                failed
                    ? 'Video could not load on this connection'
                    : item.storeName,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary.withValues(alpha: 0.5),
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
