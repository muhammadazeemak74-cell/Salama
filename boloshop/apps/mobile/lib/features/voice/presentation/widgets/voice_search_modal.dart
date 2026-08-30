import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/voice_filter.dart';

/// What the sheet handed back when it closed.
class VoiceSearchResult {
  const VoiceSearchResult({required this.filters, required this.transcript});

  final Set<VoiceFilter> filters;
  final String transcript;
}

/// The Bolo voice search sheet.
///
/// "Bolo" is Urdu for "speak". A buyer who cannot type a product name in
/// English says it instead, and the app turns what it heard into filter chips
/// they can see and correct — the transcription is the unreliable part, so it
/// is shown rather than acted on invisibly.
///
/// Speech capture is not wired up. This runs a scripted sequence — listening,
/// then a transcript, then chips — over the real animation and state machine,
/// so the UI is finished and only the recogniser has to be dropped in. It is
/// labelled on screen as a demo rather than pretending to hear anything.
class VoiceSearchModal extends StatefulWidget {
  const VoiceSearchModal({
    required this.initialFilters,
    super.key,
    this.transcript = demoTranscript,
  });

  /// Whatever the feed is already filtered by, so reopening the sheet shows
  /// the current state instead of starting blank.
  final Set<VoiceFilter> initialFilters;

  /// The text the recogniser "returned".
  final String transcript;

  /// Roman Urdu, because that is how this market types and speaks a search.
  static const String demoTranscript = '3,000 PKR tak ka lawn suit';

  /// Opens the sheet. Resolves to null if it was dismissed without applying.
  static Future<VoiceSearchResult?> show(
    BuildContext context, {
    Set<VoiceFilter> initialFilters = const <VoiceFilter>{},
  }) {
    return showModalBottomSheet<VoiceSearchResult>(
      context: context,
      // Translucent over the feed: the video keeps playing behind it, so the
      // sheet reads as a layer on the product rather than a different screen.
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      isScrollControlled: true,
      showDragHandle: false,
      builder: (context) => VoiceSearchModal(initialFilters: initialFilters),
    );
  }

  @override
  State<VoiceSearchModal> createState() => _VoiceSearchModalState();
}

enum _VoicePhase { listening, transcribing, ready }

class _VoiceSearchModalState extends State<VoiceSearchModal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _waveController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  late Set<VoiceFilter> _filters = Set<VoiceFilter>.from(widget.initialFilters);

  _VoicePhase _phase = _VoicePhase.listening;

  /// Held so they can be cancelled: a sheet dismissed after half a second must
  /// not leave work scheduled that wakes up against a disposed State.
  Timer? _transcribeTimer;
  Timer? _readyTimer;

  @override
  void initState() {
    super.initState();
    _runScriptedCapture();
  }

  /// Stands in for the recogniser: listening, then a transcript, then the
  /// chips it produced. Replace with the speech plugin's callbacks.
  void _runScriptedCapture() {
    _transcribeTimer = Timer(const Duration(milliseconds: 1600), () {
      if (!mounted) return;
      setState(() => _phase = _VoicePhase.transcribing);

      _readyTimer = Timer(const Duration(milliseconds: 700), () {
        if (!mounted) return;
        setState(() {
          _phase = _VoicePhase.ready;
          // What "3,000 tak ka lawn suit" parses to.
          _filters = {VoiceFilter.lawnSuits, VoiceFilter.underThreeThousand};
        });
      });
    });
  }

  @override
  void dispose() {
    _transcribeTimer?.cancel();
    _readyTimer?.cancel();
    _waveController.dispose();
    super.dispose();
  }

  void _toggle(VoiceFilter filter) {
    setState(() {
      if (!_filters.remove(filter)) _filters.add(filter);
    });
  }

  void _apply() {
    Navigator.of(
      context,
    ).pop(VoiceSearchResult(filters: _filters, transcript: widget.transcript));
  }

  String get _statusLabel => switch (_phase) {
    _VoicePhase.listening => 'Listening in Roman Urdu…',
    _VoicePhase.transcribing => 'Samajh raha hoon…',
    _VoicePhase.ready => 'Yeh mila — tap to change',
  };

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          decoration: BoxDecoration(
            color: AppColors.cardOverlay,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.textTertiary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              Row(
                children: [
                  const Text('🎙️', style: TextStyle(fontSize: 18, height: 1)),
                  const SizedBox(width: 8),
                  Text(
                    'Bolo',
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  const _DemoChip(),
                ],
              ),
              const SizedBox(height: 18),

              _AudioVisualizer(
                controller: _waveController,
                isListening: _phase != _VoicePhase.ready,
              ),
              const SizedBox(height: 16),

              Center(
                child: Text(
                  _statusLabel,
                  style: textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 14),

              _TranscriptLine(
                transcript: widget.transcript,
                isRevealed: _phase != _VoicePhase.listening,
              ),
              const SizedBox(height: 18),

              _FilterChips(
                filters: _filters,
                enabled: _phase == _VoicePhase.ready,
                onToggle: _toggle,
              ),
              const SizedBox(height: 20),

              _ApplyButton(
                count: _filters.length,
                enabled: _phase == _VoicePhase.ready,
                onPressed: _apply,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Marks the scripted capture as what it is. Removing this label is part of
/// wiring up a real recogniser, not a separate cleanup.
class _DemoChip extends StatelessWidget {
  const _DemoChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Text(
        'Demo',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppColors.textTertiary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// The pulsing waveform.
///
/// Bars are driven by a single repeating controller through a phase offset per
/// bar, so the whole thing is one animation rather than thirty — a feed page is
/// already decoding video behind this sheet.
class _AudioVisualizer extends StatelessWidget {
  const _AudioVisualizer({required this.controller, required this.isListening});

  final AnimationController controller;
  final bool isListening;

  static const int _barCount = 27;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          return CustomPaint(
            painter: _WavePainter(
              progress: controller.value,
              isListening: isListening,
              barCount: _barCount,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }
}

class _WavePainter extends CustomPainter {
  const _WavePainter({
    required this.progress,
    required this.isListening,
    required this.barCount,
  });

  final double progress;
  final bool isListening;
  final int barCount;

  @override
  void paint(Canvas canvas, Size size) {
    final gap = size.width / barCount;
    final barWidth = math.max(2.0, gap * 0.42);
    final centreY = size.height / 2;

    for (var i = 0; i < barCount; i++) {
      // Two offset sine waves so the bars do not march in lockstep, and an
      // envelope that keeps the middle taller than the edges — the shape a
      // voice actually makes.
      final t = i / (barCount - 1);
      final phase = progress * 2 * math.pi;
      final wave =
          math.sin(phase + t * math.pi * 3) * 0.6 +
          math.sin(phase * 1.7 + t * math.pi * 5) * 0.4;
      final envelope = math.sin(t * math.pi);

      // Once capture is done the bars stop moving but keep a shape: a frozen
      // waveform reads as "this is what I heard", where collapsing to a flat
      // line reads as the visualizer having died.
      final amplitude = isListening
          ? 0.35 + 0.65 * wave.abs()
          : 0.30 + 0.45 * math.sin(t * math.pi * 7).abs();
      final height = math.max(3.0, size.height * 0.86 * amplitude * envelope);

      // Green at the centre bleeding to rose at the edges: the two brand
      // accents, used to give the waveform a direction rather than a flat fill.
      final colour = Color.lerp(
        AppColors.electricRose,
        AppColors.primaryGreen,
        envelope,
      )!;

      final x = gap * i + (gap - barWidth) / 2;
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, centreY - height / 2, barWidth, height),
        Radius.circular(barWidth / 2),
      );

      canvas.drawRRect(
        rect,
        Paint()..color = colour.withValues(alpha: isListening ? 0.95 : 0.55),
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.isListening != isListening;
}

/// What Bolo heard.
class _TranscriptLine extends StatelessWidget {
  const _TranscriptLine({required this.transcript, required this.isRevealed});

  final String transcript;
  final bool isRevealed;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: isRevealed ? 1 : 0,
      duration: const Duration(milliseconds: 250),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceRaised,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Text(
          '“$transcript”',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w600,
            height: 1.3,
          ),
        ),
      ),
    );
  }
}

/// The smart filter chips.
class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.filters,
    required this.enabled,
    required this.onToggle,
  });

  final Set<VoiceFilter> filters;
  final bool enabled;
  final ValueChanged<VoiceFilter> onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        for (final filter in VoiceFilter.values)
          _FilterChip(
            filter: filter,
            isSelected: filters.contains(filter),
            enabled: enabled,
            onTap: () => onToggle(filter),
          ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.filter,
    required this.isSelected,
    required this.enabled,
    required this.onTap,
  });

  final VoiceFilter filter;
  final bool isSelected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: filter.label,
      child: AnimatedOpacity(
        opacity: enabled ? 1 : 0.35,
        duration: const Duration(milliseconds: 200),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          child: InkWell(
            onTap: enabled ? onTap : null,
            borderRadius: BorderRadius.circular(999),
            child: Ink(
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primaryGreen
                    : AppColors.surfaceRaised,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: isSelected
                      ? AppColors.primaryGreen
                      : AppColors.cardBorder,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 9,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isSelected) ...[
                      const Icon(Icons.check, size: 14, color: Colors.black),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      filter.label,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: isSelected
                            ? Colors.black
                            : AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ApplyButton extends StatelessWidget {
  const _ApplyButton({
    required this.count,
    required this.enabled,
    required this.onPressed,
  });

  final int count;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    // Applying nothing is a real choice — it clears the feed's filters — so
    // the button stays live and says what it will do.
    final label = count == 0
        ? 'Show everything'
        : 'Show $count filter'
              '${count == 1 ? '' : 's'}';

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            gradient: AppColors.soloBuyGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Opacity(
            opacity: enabled ? 1 : 0.4,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Center(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
