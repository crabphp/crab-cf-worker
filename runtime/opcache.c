/* Static Zend-extension registration: no dlopen/dynamic Wasm module. */
#include <php.h>
#include <Zend/zend_extensions.h>
extern zend_extension zend_extension_entry;
extern void __real_zend_startup_extensions(void);
void __wrap_zend_startup_extensions(void) {
    zend_register_extension(&zend_extension_entry, NULL);
    __real_zend_startup_extensions();
}
