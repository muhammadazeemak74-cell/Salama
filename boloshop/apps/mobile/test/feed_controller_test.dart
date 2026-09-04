import 'package:boloshop/features/feed/data/feed_repository.dart';
import 'package:boloshop/features/feed/domain/feed_item.dart';
import 'package:boloshop/features/feed/presentation/feed_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A repository that answers from memory, so the controller can be tested
/// without a gateway on the other end of a socket.
class _FakeRepository implements FeedRepository {
  _FakeRepository({this.items, this.fails = false});

  final List<FeedItem>? items;
  final bool fails;

  @override
  Future<List<FeedItem>> fetchFeed({int limit = 20}) async {
    if (fails) throw Exception('gateway unreachable');
    return items ?? const <FeedItem>[];
  }
}

const _remoteItem = FeedItem(
  id: 'remote-1',
  sellerId: 'bbbbbbbb-0000-0000-0000-000000000001',
  productTitle: 'Remote Product',
  fabricSpecs: 'From the gateway',
  soloPricePkr: '1000.00',
  teamPricePkr: '700.00',
  storeName: 'Remote Store',
  sellerHandle: '@remote',
  city: 'Multan',
  likeCount: 4,
  commentCount: 1,
  isLive: false,
  liveViewerCount: 0,
);

ProviderContainer containerWith(FeedRepository repository) {
  final container = ProviderContainer(
    overrides: [feedRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('starts on sample content so the first frame is never empty', () {
    final container = containerWith(
      _FakeRepository(items: const [_remoteItem]),
    );
    final initial = container.read(feedControllerProvider);

    expect(initial.items, isNotEmpty);
    expect(initial.items.first.id, sampleFeed.first.id);
    expect(initial.isLoading, isTrue);
  });

  test('replaces the samples once the gateway answers', () async {
    final container = containerWith(
      _FakeRepository(items: const [_remoteItem]),
    );
    container.read(feedControllerProvider);

    await container.read(feedControllerProvider.notifier).refresh();

    final state = container.read(feedControllerProvider);
    expect(state.items.single.id, 'remote-1');
    expect(state.errorMessage, isNull);
  });

  test(
    'keeps the samples and says so when the gateway is unreachable',
    () async {
      final container = containerWith(_FakeRepository(fails: true));
      container.read(feedControllerProvider);

      await container.read(feedControllerProvider.notifier).refresh();

      final state = container.read(feedControllerProvider);
      expect(state.items.first.id, sampleFeed.first.id);
      // The UI must be able to tell the user these are not real products.
      expect(state.errorMessage, isNotNull);
      expect(state.isLoading, isFalse);
    },
  );

  test(
    'an empty catalog falls back to the samples rather than a blank feed',
    () async {
      final container = containerWith(_FakeRepository(items: const []));
      container.read(feedControllerProvider);

      await container.read(feedControllerProvider.notifier).refresh();

      expect(container.read(feedControllerProvider).items, isNotEmpty);
    },
  );

  test('toggleLike moves the count by exactly one, both ways', () async {
    final container = containerWith(
      _FakeRepository(items: const [_remoteItem]),
    );
    container.read(feedControllerProvider);
    await container.read(feedControllerProvider.notifier).refresh();

    final controller = container.read(feedControllerProvider.notifier);

    controller.toggleLike('remote-1');
    var item = container.read(feedControllerProvider).items.single;
    expect(item.isLiked, isTrue);
    expect(item.likeCount, 5);

    controller.toggleLike('remote-1');
    item = container.read(feedControllerProvider).items.single;
    expect(item.isLiked, isFalse);
    expect(item.likeCount, 4);
  });

  test('toggleLike leaves other items alone', () async {
    final container = containerWith(_FakeRepository());
    container.read(feedControllerProvider);

    final controller = container.read(feedControllerProvider.notifier);
    controller.toggleLike(sampleFeed.first.id);

    final items = container.read(feedControllerProvider).items;
    expect(items.first.isLiked, isTrue);
    expect(items.skip(1).every((item) => !item.isLiked), isTrue);
  });

  test('tracks the visible page', () async {
    final container = containerWith(_FakeRepository());
    container.read(feedControllerProvider);

    final controller = container.read(feedControllerProvider.notifier);
    controller.onPageChanged(2);

    final state = container.read(feedControllerProvider);
    expect(state.currentIndex, 2);
    expect(state.current?.id, sampleFeed[2].id);
  });
}
