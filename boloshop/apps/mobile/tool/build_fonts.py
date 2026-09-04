#!/usr/bin/env python3
"""Rebuild the bundled font assets in assets/fonts/.

The app ships its fonts rather than fetching them at runtime, so this is how
those .ttf files were produced. Run it when a weight is added or a font is
updated; the output is committed, so a normal build never needs it.

    python3 tool/build_fonts.py

Needs npm (the fonts come from the @expo-google-fonts packages, which
redistribute the Google Fonts originals as static .ttf) and fontTools:

    pip install fonttools

Inter is subsetted. The upstream file carries Latin, Greek, Cyrillic and
Vietnamese at ~343 KB a weight, and five weights of that is 1.7 MB of APK
this market pays for over a metered connection to render an English and
Roman-Urdu interface. Noto Nastaliq Urdu is NOT subsetted: Nastaliq renders
through long ligature-substitution chains, and dropping glyphs it looks
unreachable breaks words rather than trimming them.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MOBILE = Path(__file__).resolve().parent.parent
OUT = MOBILE / 'assets' / 'fonts'

# What the interface needs, and nothing else:
#   0020-00FF  Basic Latin and Latin-1, which is the interface
#   0100-017F  Latin Extended-A, for names carrying diacritics
#   2000-206F  General punctuation: the em dash, bullet, ellipsis and curly
#              quotes the copy is written with
#   20A0-20BF  Currency symbols, which is where ₨ U+20A8 lives — without this
#              range every price on every screen renders as tofu
#   2212       The true minus sign, used in the saving figures
INTER_UNICODES = 'U+0020-00FF,U+0100-017F,U+2000-206F,U+20A0-20BF,U+2212'

INTER_WEIGHTS = {
    '400Regular': 'Inter-Regular.ttf',
    '500Medium': 'Inter-Medium.ttf',
    '600SemiBold': 'Inter-SemiBold.ttf',
    '700Bold': 'Inter-Bold.ttf',
    '800ExtraBold': 'Inter-ExtraBold.ttf',
}

# Regular only, at half a megabyte. The interface renders no Urdu script yet —
# the copy is Roman Urdu in Latin letters — so this is here to keep Urdu text
# from the backend from arriving as tofu, and a second weight nobody renders is
# pure download on a metered connection. Bold synthesises meanwhile, which is
# not what Nastaliq deserves: add '700Bold' here when Urdu-script copy lands.
URDU_WEIGHTS = {
    '400Regular': 'NotoNastaliqUrdu-Regular.ttf',
}


def fetch(package: str, into: Path) -> Path:
    """npm pack the package and unpack it. Returns the package root."""
    print(f'  fetching {package} ...')
    result = subprocess.run(
        ['npm', 'pack', package, '--silent'],
        cwd=into, capture_output=True, text=True, check=True,
    )
    tarball = into / result.stdout.strip().splitlines()[-1]
    target = into / package.replace('/', '_').lstrip('@')
    target.mkdir(parents=True, exist_ok=True)
    subprocess.run(['tar', 'xzf', str(tarball), '-C', str(target)], check=True)
    return target / 'package'


def subset(source: Path, destination: Path) -> None:
    subprocess.run(
        [
            sys.executable, '-m', 'fontTools.subset', str(source),
            f'--unicodes={INTER_UNICODES}',
            # Kerning and the standard ligatures are why this font was chosen.
            '--layout-features=*',
            '--name-IDs=*',
            f'--output-file={destination}',
        ],
        check=True, capture_output=True,
    )


def codepoints_of(font: Path) -> set[int]:
    from fontTools.ttLib import TTFont

    with TTFont(font) as ttf:
        return set(ttf.getBestCmap())


def interface_codepoints() -> set[int]:
    """Every non-ASCII character the Dart sources actually render.

    Emoji are excluded: they come from the platform's colour emoji font, and
    no text font here is expected to carry them.
    """
    wanted: set[int] = set()
    for path in sorted((MOBILE / 'lib').rglob('*.dart')):
        for char in path.read_text(encoding='utf-8'):
            point = ord(char)
            if point < 0x7F:
                continue
            is_emoji = (
                point >= 0x1F000
                or 0x2600 <= point <= 0x27BF
                or point == 0xFE0F
            )
            if not is_emoji:
                wanted.add(point)
    return wanted


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as raw:
        work = Path(raw)

        inter = fetch('@expo-google-fonts/inter', work)
        urdu = fetch('@expo-google-fonts/noto-nastaliq-urdu', work)

        print('\n  subsetting Inter ...')
        for weight, name in INTER_WEIGHTS.items():
            source = inter / weight / f'Inter_{weight}.ttf'
            subset(source, OUT / name)

        print('  copying Noto Nastaliq Urdu ...')
        for weight, name in URDU_WEIGHTS.items():
            shutil.copyfile(urdu / weight / f'NotoNastaliqUrdu_{weight}.ttf', OUT / name)

        # The OFL requires the licence to travel with the fonts.
        shutil.copyfile(inter / 'LICENSE_FONT', OUT / 'OFL.txt')

    print('\n  verifying coverage ...')
    required = interface_codepoints()
    failures = 0
    for name in INTER_WEIGHTS.values():
        missing = required - codepoints_of(OUT / name)
        if missing:
            failures += 1
            listed = ', '.join(f'U+{point:04X}' for point in sorted(missing))
            print(f'    FAIL {name}: missing {listed}')
    if failures:
        print('\n  A character the app renders is not in the subset. Widen '
              'INTER_UNICODES rather than shipping tofu.')
        return 1

    checked = ', '.join(f'U+{point:04X}' for point in sorted(required))
    print(f'    every Inter weight covers the {len(required)} non-ASCII '
          f'characters lib/ renders: {checked}')

    print('\n  assets/fonts:')
    total = 0
    for path in sorted(OUT.iterdir()):
        total += path.stat().st_size
        print(f'    {path.stat().st_size / 1024:8.1f} KB  {path.name}')
    print(f'    {total / 1024:8.1f} KB  total')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
