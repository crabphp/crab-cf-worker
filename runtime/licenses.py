"""Distribute notices beside the runtime, without spending isolate CPU on them."""
from pathlib import Path
import shutil
import sys

php = Path(sys.argv[1])
root = Path('/src/runtime/dist/licenses')
if root.exists():
    shutil.rmtree(root)
notices = {
    'php/LICENSE': php / 'LICENSE',
    'php/ZEND-LICENSE': php / 'Zend/LICENSE',
    'php/THIRD-PARTY-LICENSES': php / 'README.REDIST.BINS',
    'php/TIMELIB-LICENSE': php / 'ext/date/lib/LICENSE.rst',
    'php/LIBMBFL-LICENSE': php / 'ext/mbstring/libmbfl/LICENSE',
    'emscripten/LICENSE': Path('/emsdk/upstream/emscripten/LICENSE'),
    'emscripten/MUSL-COPYRIGHT': Path('/emsdk/upstream/emscripten/system/lib/libc/musl/COPYRIGHT'),
    'emscripten/COMPILER-RT-LICENSE': Path('/emsdk/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT'),
    'emscripten/LIBCXX-LICENSE': Path('/emsdk/upstream/emscripten/system/lib/libcxx/LICENSE.TXT'),
}
app = Path('/src/runtime/.build/app')
for file in sorted((app / 'vendor').rglob('*')):
    if file.is_file() and file.name.upper().startswith(('LICENSE', 'COPYING', 'NOTICE')):
        notices[str(file.relative_to(app))] = file
for name, source in notices.items():
    destination = root / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
