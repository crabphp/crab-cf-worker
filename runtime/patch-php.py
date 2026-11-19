"""Small, explicit platform fixes against the checksum-pinned php-src tarball."""
from pathlib import Path
import sys
import re
import tarfile

root = Path(sys.argv[1])
# Always patch the verified originals, not a previous patch revision in cache.
with tarfile.open(root.parent / (root.name + '.tar.xz')) as archive:
    original_alloc = archive.extractfile(root.name + '/Zend/zend_alloc.c').read().decode()
    original_opcache = archive.extractfile(root.name + '/ext/opcache/ZendAccelerator.c').read().decode()
path = root / 'Zend/zend_alloc.c'
source = original_alloc
# Zend overmaps then partially unmaps to align 2 MiB chunks. Emscripten munmap
# cannot release partial mappings. Keep Zend's allocator and PHP memory limit,
# but obtain its chunks through posix_memalign; shrinking/growing can fall back
# to allocate/copy/free. No framework changes, no Asyncify, no ignored errors.
patches = {
    'static void zend_mm_munmap(void *addr, size_t size)\n{':
        'static void zend_mm_munmap(void *addr, size_t size)\n{\n#ifdef __EMSCRIPTEN__\n\tfree(addr); return;\n#endif',
    'static void *zend_mm_chunk_alloc_int(size_t size, size_t alignment)\n{':
        'static void *zend_mm_chunk_alloc_int(size_t size, size_t alignment)\n{\n#ifdef __EMSCRIPTEN__\n\tvoid *memory = NULL;\n\tif (posix_memalign(&memory, alignment, size) != 0) return NULL;\n\tmemset(memory, 0, size);\n\treturn memory;\n#endif',
    'static int zend_mm_chunk_truncate(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{':
        'static int zend_mm_chunk_truncate(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{\n#ifdef __EMSCRIPTEN__\n\treturn 0;\n#endif',
    'static int zend_mm_chunk_extend(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{':
        'static int zend_mm_chunk_extend(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{\n#ifdef __EMSCRIPTEN__\n\treturn 0;\n#endif',
}
for old, new in patches.items():
    assert source.count(old) == 1, old
    source = source.replace(old, new)
if source != path.read_text():
    path.write_text(source)

path = root / 'ext/opcache/ZendAccelerator.c'
source = original_opcache
old = '\t\t"ngx-php",\n'
new = '\t\t"ngx-php",\n\t\t"embed", /* Crab: static embed, file-cache-only, no JIT. */\n'
assert source.count(old) == 1
source = source.replace(old, new)
if source != path.read_text():
    path.write_text(source)

# configure otherwise embeds the container ID and host kernel, defeating
# reproducibility even with a pinned toolchain and SOURCE_DATE_EPOCH.
path = root / 'main/php_config.h'
if path.exists():
    source = path.read_text()
    normalized, count = re.subn(r'^#define (PHP_BUILD_SYSTEM|PHP_UNAME) .*$',
        r'#define \1 "Emscripten 4.0.20 wasm64"', source, flags=re.M)
    assert count == 2
    if normalized != source:
        path.write_text(normalized)
