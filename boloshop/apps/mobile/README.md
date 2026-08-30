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
lib/core/session/session.dart                    who is signed in
lib/core/launcher/url_launcher_service.dart      opening external links
lib/features/orders/                             buy flows, order models, share dialog
lib/features/voice/                              Bolo search modal and its filters
```

## Running

```bash
flutter pub get
flutter run
flutter analyze     # must be clean
flutter test        # 62 unit and widget tests
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

## Buying

Both buttons go through `OrderActions`, and both start with the same call —
`POST /api/v1/orders` on the Go order service.

**Solo Buy** places the order at the solo price, then opens the `wa.me` link the
service built, addressed to that seller's number with the confirmation message
already written. The 1% commission comes back in the response; the app displays
it and never computes it, because it is a generated column in Postgres.

**Team Buy** places the same order and then calls
`POST /api/v1/team-buy/create` on it. That endpoint opens a team purchase on an
order that already exists and is still pending, so the order has to come first —
one tap, two calls. The dialog that follows shows the 24-hour share link, a
countdown, and a WhatsApp invite button that opens the contact picker
(`https://wa.me/?text=…`, no number) with the invitation ready to send.

The discount is **not** applied by the app. The order is created at the solo
price and the order service takes the percentage off when a friend actually
joins, which also recomputes the commission. Until then the buyer is committed
to the full price, and the dialog says so.

A buy in flight blocks the feed, and a second tap returns
`BuyAlreadyInProgress` rather than placing a second cash-on-delivery order.

### Android package visibility

`android/app/src/main/AndroidManifest.xml` declares an `<intent>` query for
`VIEW` + `https`. Without it, Android 11+ filters the intent, `url_launcher`
resolves nothing, and the launch fails in a way indistinguishable from WhatsApp
not being installed.

## Bolo voice search

Tapping the green Bolo bar opens a translucent bottom sheet: an animated
waveform, a state line in Roman Urdu, the transcript it heard, and the filter
chips that transcript produced. Chips are editable before applying — the
transcription is the unreliable part of the feature, so it is shown and
corrected rather than acted on invisibly.

Applying sets the feed's filter set. Filters combine with AND, the page resets
to the top, and a bar under the status bar shows the transcript, the match count
and a way out. `< ₨ 3,000` matches on the **team** price — the lowest a buyer
can actually reach — because a group-buy app that hides a ₨2,450 suit from an
"under ₨3,000" search is hiding its own product.

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

- **No auth flow, so no buyer id.** The gateway's OTP endpoints exist; the
  screens that call them do not. Until then the buyer comes from
  `--dart-define=DEMO_BUYER_ID=<uuid of a verified user>`, and without it both
  buy buttons say "sign in" rather than sending an invented UUID that the order
  service would reject with a confusing 404. `SessionController.signIn` is the
  seam.
- **Speech capture is not wired up.** The voice sheet runs a scripted sequence
  over the real animation, state machine and filter logic, and is labelled
  "Demo" on screen. Only the recogniser has to be dropped in.
- **Comments and the rail's share button** still acknowledge the tap and stop.
- **`Icons.share` stands in for the WhatsApp glyph** until brand assets land.
- **google_fonts fetches Inter at runtime**, which is the wrong trade for this
  market. Bundle the `.ttf` and turn runtime fetching off before release.
