"""Small, explicit platform fixes against the checksum-pinned php-src tarball."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
path = root / 'Zend/zend_alloc.c'
source = path.read_text()
# Zend overmaps then partially unmaps to align 2 MiB chunks. Emscripten munmap
# cannot release partial mappings. Keep Zend's allocator and PHP memory limit,
# but obtain its chunks through aligned_alloc; shrinking/growing can fall back
# to allocate/copy/free. No framework changes, no Asyncify, no ignored errors.
patches = {
    'static void zend_mm_munmap(void *addr, size_t size)\n{':
        'static void zend_mm_munmap(void *addr, size_t size)\n{\n#ifdef __EMSCRIPTEN__\n\tfree(addr); return;\n#endif',
    'static void *zend_mm_chunk_alloc_int(size_t size, size_t alignment)\n{':
        'static void *zend_mm_chunk_alloc_int(size_t size, size_t alignment)\n{\n#ifdef __EMSCRIPTEN__\n\tvoid *memory = aligned_alloc(alignment, size);\n\tif (memory) memset(memory, 0, size);\n\treturn memory;\n#endif',
    'static int zend_mm_chunk_truncate(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{':
        'static int zend_mm_chunk_truncate(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{\n#ifdef __EMSCRIPTEN__\n\treturn 0;\n#endif',
    'static int zend_mm_chunk_extend(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{':
        'static int zend_mm_chunk_extend(zend_mm_heap *heap, void *addr, size_t old_size, size_t new_size)\n{\n#ifdef __EMSCRIPTEN__\n\treturn 0;\n#endif',
}
for old, new in patches.items():
    if new in source:
        continue
    assert source.count(old) == 1, old
    source = source.replace(old, new)
if source != path.read_text():
    path.write_text(source)
