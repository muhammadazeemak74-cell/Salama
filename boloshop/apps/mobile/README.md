# BoloShop mobile

The Flutter app: a full-bleed vertical video feed where every page is a product
you can buy alone or with a friend.

## Layout

```
lib/main.dart                                    entrypoint, dark theme, routing
lib/core/theme/app_colors.dart                   the palette
lib/core/theme/app_theme.dart                    ThemeData + system overlay style
lib/core/network/api_client.dart                 both backends, one client
lib/core/utils/pkr.dart                          PKR formatting and savings maths
lib/features/feed/domain/feed_item.dart          the model
lib/features/feed/data/feed_repository.dart      gateway calls + sample content
lib/features/feed/presentation/feed_controller.dart      Riverpod state
lib/features/feed/presentation/screens/feed_screen.dart  the feed
lib/features/feed/presentation/widgets/          badge, voice button, rail, card
```

## Running

```bash
flutter pub get
flutter run
flutter analyze     # must be clean
flutter test        # 27 unit and widget tests
```

Point the app at your machine's backends:

```bash
flutter run \
  --dart-define=GATEWAY_BASE_URL=http://192.168.1.5:4000 \
  --dart-define=ORDER_SERVICE_BASE_URL=http://192.168.1.5:4002
```

Without those defines it targets `localhost:4000` and `localhost:4002` — except
on Android, where it rewrites the host to `10.0.2.2`. Inside an emulator
`localhost` is the emulator itself, not your machine, and the resulting failure
looks exactly like the server being down.

If the gateway is unreachable the feed falls back to four sample products and
says so in a pill under the status bar, rather than pretending a hardcoded list
is the catalog.

## The feed

`PreloadPageView` with `preloadPagesCount: 1`, so the next video has started
buffering by the time a thumb reaches it — but only one page either side. Two
would buffer more aggressively than a metered data bundle deserves.

Only the visible page holds a `VideoPlayerController`. Decoders are a scarce
hardware resource on the mid-range Androids this app targets, and keeping one
alive per built page drops frames or fails to initialise outright. Video
autoplays muted; a feed that shouts when it opens gets closed.

A page whose seller has no rendered video yet — media-service may still be
working on it — shows a branded poster instead of a black rectangle.

## Design notes

Dark only. The product is edge-to-edge video and light chrome would fight every
frame, so there is no light variant to fall back to.

The two accents are fully saturated and the surfaces are translucent black
rather than opaque grey, because everything here sits over an arbitrary
photograph. Both scrims exist for the same reason: white text over a bright
lawn print is unreadable exactly when the product photographs best.

The dual CTA gives solo and team buy equal weight and different colours rather
than a primary and a ghost button. Team buy is wider and rose — the cheaper
option is deliberately the louder one, because it is the growth loop.

## Money

Prices are strings the whole way through. They are `NUMERIC(12,2)` in Postgres
and a `double` cannot hold every rupee value exactly, so they are formatted for
display without ever being parsed into one. The "Save 30%" badge is computed in
integer paisa from the two prices, not hardcoded in the view — if the backend
sends a different team price the badge follows it.

## Known gaps

- **Buttons are wired to a SnackBar, not to checkout.** Solo buy, team buy,
  comments and share acknowledge the tap and stop there. The order and team-buy
  endpoints exist in `services/order-service`; nothing calls them yet.
- **`Icons.share` stands in for the WhatsApp glyph** until brand assets land.
- **google_fonts fetches Inter at runtime**, which is the wrong trade for this
  market. Bundle the `.ttf` and turn runtime fetching off before release.
- **No auth flow.** `ApiClient.authToken` is the seam; the OTP screens that
  fill it are not built.
