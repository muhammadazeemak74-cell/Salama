import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/session/session.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/pkr.dart';
import '../../../auth/domain/pakistan_phone.dart';
import '../../../feed/presentation/screens/feed_screen.dart';
import '../../../orders/presentation/order_stats.dart';

/// Who is signed in, what they have ordered, and the way out.
///
/// Opened from the feed's top bar. Everything on it comes from the session and
/// the local order tally, so it renders instantly and offline — a drawer that
/// spins on a Pakistani mobile connection before it can tell you your own
/// phone number is not worth opening.
class ProfileDrawer extends ConsumerWidget {
  const ProfileDrawer({super.key});

  /// buyer / seller / admin as the gateway spells them, title-cased for a
  /// person. Anything unrecognised reads as Buyer, which is what an account
  /// with no explicit role is.
  static String roleLabel(String? role) => switch (role) {
    'seller' => 'Seller',
    'admin' => 'Admin',
    _ => 'Buyer',
  };

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    // Captured before the await: the drawer is gone by the time signOut
    // returns, and its context with it.
    final navigator = Navigator.of(context);

    navigator.pop();
    await ref.read(sessionProvider.notifier).signOut();

    // Root route, whole stack cleared. The gate at '/' now reads a signed-out
    // session and renders the login screen; clearing rather than popping
    // matters because a feed left underneath would still hold the previous
    // user's video controllers and their product list.
    navigator.pushNamedAndRemoveUntil(
      FeedScreen.routeName,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final stats = ref.watch(orderStatsProvider);
    final textTheme = Theme.of(context).textTheme;

    final phone = session.phoneNumber;

    return Drawer(
      backgroundColor: AppColors.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          gradient: AppColors.soloBuyGradient,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.person_rounded,
                          color: Colors.black,
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              // The DEMO_BUYER_ID build has an id but no
                              // number, and inventing one would be worse than
                              // saying which kind of session this is.
                              phone == null || phone.isEmpty
                                  ? 'Demo session'
                                  : formatForDisplay(phone),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: textTheme.titleMedium?.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _RoleChip(
                                  label: roleLabel(session.user?.role),
                                ),
                                // A demo identity looks exactly like a real
                                // one here — same number, same role — so it
                                // has to say which it is.
                                if (session.isDemo) ...[
                                  const SizedBox(width: 6),
                                  const _RoleChip(
                                    label: 'DEMO',
                                    muted: true,
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: AppColors.cardBorder),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Text(
                'Orders this session',
                style: textTheme.labelMedium?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: stats.isEmpty
                  ? Text(
                      'Nothing ordered yet. Tap Buy Now on a product and it '
                      'shows up here.',
                      style: textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                        height: 1.4,
                      ),
                    )
                  : Row(
                      children: [
                        _StatTile(
                          value: '${stats.ordersPlaced}',
                          label: stats.ordersPlaced == 1 ? 'Order' : 'Orders',
                        ),
                        const SizedBox(width: 10),
                        _StatTile(
                          value: '${stats.teamBuysOpened}',
                          label: 'Team buys',
                        ),
                        const SizedBox(width: 10),
                        _StatTile(
                          value: formatPkr(stats.totalAmountPkr),
                          label: 'COD value',
                        ),
                      ],
                    ),
            ),

            const Spacer(),

            // The record is this device's, not the account's: the order
            // service has no endpoint to list a buyer's orders yet, and a
            // count that silently means something narrower than it says is
            // how a buyer ends up believing an order was never placed.
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
              child: Text(
                'Counted on this device since you signed in. Your full order '
                'history lives with the seller on WhatsApp.',
                style: textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                  height: 1.4,
                  fontSize: 11,
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: OutlinedButton.icon(
                onPressed: () => _signOut(context, ref),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Sign out'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.electricRose,
                  side: const BorderSide(color: AppColors.electricRose),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.label, this.muted = false});

  final String label;

  /// Draws in the secondary text colour rather than the brand green, for a
  /// chip that qualifies the identity instead of describing it.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final color = muted ? AppColors.textSecondary : AppColors.primaryGreen;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// One number and its caption. Equal-width so three of them line up whatever
/// the values are, and the value wraps rather than overflowing when a total
/// runs to six figures at a large text scale.
class _StatTile extends StatelessWidget {
  const _StatTile({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceRaised,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textTheme.titleSmall?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 2,
              style: textTheme.labelSmall?.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
