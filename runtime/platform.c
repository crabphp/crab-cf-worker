/* Emscripten has no processes or native stack switching. The synchronous Crab
 * request adapter never starts a Fiber. Fail explicitly instead of importing
 * host APIs or enabling Asyncify across the whole interpreter.
 */
#include <errno.h>
#include <stdlib.h>
#include <spawn.h>
#include <ucontext.h>
#include <grp.h>

int initgroups(const char *user, gid_t group) { errno = ENOSYS; return -1; }

int getdtablesize(void) { return 1024; }
int posix_spawnp(pid_t *pid, const char *file, const posix_spawn_file_actions_t *actions,
                 const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
    return ENOSYS;
}
int getcontext(ucontext_t *context) { errno = ENOSYS; return -1; }
int swapcontext(ucontext_t *old, const ucontext_t *next) { errno = ENOSYS; return -1; }
void makecontext(ucontext_t *context, void (*function)(void), int argc, ...) { abort(); }
