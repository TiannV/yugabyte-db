<img src="https://www.yugabyte.com/wp-content/uploads/2021/05/yb_horizontal_alt_color_RGB.png" align="center" alt="YugabyteDB" width="50%"/>

---------------------------------------

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Documentation Status](https://readthedocs.org/projects/ansicolortags/badge/?version=latest)](https://docs.yugabyte.com/)
[![Ask in forum](https://img.shields.io/badge/ask%20us-forum-orange.svg)](https://forum.yugabyte.com/)
[![Slack chat](https://img.shields.io/badge/Slack:-%23yugabyte_db-blueviolet.svg?logo=slack)](https://www.yugabyte.com/slack)
[![Analytics](https://yugabyte.appspot.com/UA-104956980-4/home?pixel&useReferer)](https://github.com/yugabyte/ga-beacon)

# 1. compile YB for aarch64

cpu info:
```
# lscpu
Architecture:          aarch64
Byte Order:            Little Endian
CPU(s):                16
On-line CPU(s) list:   0-15
Thread(s) per core:    1
Core(s) per socket:    8
Socket(s):             2
NUMA node(s):          2
Model:                 0
CPU max MHz:           2400.0000
CPU min MHz:           2400.0000
BogoMIPS:              200.00
L1d cache:             64K
L1i cache:             64K
L2 cache:              512K
L3 cache:              32768K
NUMA node0 CPU(s):     0-7
NUMA node1 CPU(s):     8-15
Flags:                 fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm jscvt fcma dcpop asimddp asimdfhm
```

# 2. compire errors
## 2.1 unwind-arch
### error info:
```
Call Stack (most recent call first):
  cmake_modules/YugabyteFindThirdParty.cmake:85 (ADD_THIRDPARTY_LIB)
  CMakeLists.txt:671 (include)
```

### solve:
```
# cmake_modules/FindLibUnwind.cmake
if(CMAKE_SYSTEM_PROCESSOR MATCHES "^arm")
  SET(LIBUNWIND_ARCH "arm")
elseif (CMAKE_SYSTEM_PROCESSOR STREQUAL "x86_64" OR CMAKE_SYSTEM_PROCESSOR STREQUAL "amd64")
  SET(LIBUNWIND_ARCH "x86_64")
elseif (CMAKE_SYSTEM_PROCESSOR MATCHES "^i.86$")
  SET(LIBUNWIND_ARCH "x86")
# add by tianv
elseif (CMAKE_SYSTEM_PROCESSOR STREQUAL "aarch64")
  SET(LIBUNWIND_ARCH "aarch64")
endif()
```
## 2.2 Compilation options
### error info:
```
g++: error: unrecognized command line option ‘-msse4.2’
\-------------------------------------------------------------------------------
g++: error: unrecognized command line option ‘-mcx16’
g++: error: unrecognized command line option ‘-mno-avx’; did you mean ‘-Wno-abi’?
g++: error: unrecognized command line option ‘-mno-bmi’; did you mean ‘-Wno-abi’?
g++: error: unrecognized command line option ‘-mno-bmi2’; did you mean ‘-Wno-abi’?
g++: error: unrecognized command line option ‘-mno-fma’; did you mean ‘-Wno-hsa’?
g++: error: unrecognized command line option ‘-mno-abm’; did you mean ‘-Wno-abi’?
g++: error: unrecognized command line option ‘-mno-movbe’
g++: error: unrecognized command line option ‘-mno-fma’; did you mean ‘-Wno-hsa’?

cc1plus: error: unknown value ‘ivybridge’ for -march
cc1plus: note: valid arguments are: armv8-a armv8.1-a armv8.2-a armv8.3-a armv8.4-a native
```
### solve：
Temporarily delete 

## 2.3 atomicops
### error info:
```
src/yb/gutil/atomicops.h:102:2: error: #error You need to implement atomic operations for this architecture
 #error You need to implement atomic operations for this architecture
  ^~~~~
 ```
 ### slove:
 add a new file `yb/gutil/atomicops-internals-aarch64.h`,
 then include it in `src/yb/gutil/atomicops.h`:
 ```
 #if defined(THREAD_SANITIZER)
#include "yb/gutil/atomicops-internals-tsan.h"
...
...
#elif defined(__aarch64__) || defined(__aarch64)
#include "yb/gutil/atomicops-internals-aarch64.h"
#else
#error You need to implement atomic operations for this architecture
#endif
```

## 2.4 cpu
### error info
```
src/yb/gutil/cpu.cc:288:4: error: #error unknown architecture
   #error unknown architecture
    ^~~~~
```

### solve
add `defined(__aarch64__) ` in `src/yb/gutil/cpu.cc`
```
#elif defined(ARCH_CPU_ARM_FAMILY) && (defined(OS_ANDROID) || defined(__linux__))
  cpu_brand_.assign(g_lazy_cpuinfo.Get().brand());
  has_broken_neon_ = g_lazy_cpuinfo.Get().has_broken_neon();
#elif defined(__aarch64__)
  cpu_brand_.assign("ARM64");
  has_broken_neon_ = false;
#else
  #error unknown architecture
#endif
```
## 2.5 CycleTimer
### error info
```
src/yb/gutil/cycleclock-inl.h:214:2: error: #error You need to define CycleTimer for your O/S and CPU
 #error You need to define CycleTimer for your O/S and CPU
  ^~~~~
```

### solve
add `defined(__aarch64__) ` in `src/yb/gutil/cycleclock-inl.h`
```
#elif defined(__aarch64__)
  // System timer of ARMv8 runs at a different frequency than the CPU's.
  // The frequency is fixed, typically in the range 1-50MHz.  It can be
  // read at CNTFRQ special register.  We assume the OS has set up
  // the virtual timer properly.
inline int64 CycleClock::Now() {
  int64 virtual_timer_value;

  asm volatile("mrs %0, cntvct_el0" : "=r"(virtual_timer_value));

  return virtual_timer_value;
}
```
## 2.6 spinlock
### error info
```
src/yb/gutil/spinlock_linux-inl.h:74:19: error: ‘sys_futex’ was not declared in this scope
                   sys_futex(&x, FUTEX_WAKE, 1, 0) >= 0);
                   ^~~~~~~~~
src/yb/gutil/spinlock_linux-inl.h:74:19: note: suggested alternative: ‘have_futex’
                   sys_futex(&x, FUTEX_WAKE, 1, 0) >= 0);
```

### solve
ARM linux doesn't support sys_futex1(void*, int, int, struct timespec*);

So use `syscall` to instead.

```
    if (have_futex && syscall(__NR_futex, &x, FUTEX_WAKE | futex_private_flag,
                              1, NULL, NULL, 0) < 0) {
      futex_private_flag = 0;
    }
```

## 2.7 NR_gettid
### error info 
```
src/yb/gutil/threading/thread_collision_warner.cc:54:18: error: ‘__NR_gettid’ was not declared in this scope
   return syscall(__NR_gettid);
                  ^~~~~~~~~~~
src/yb/gutil/threading/thread_collision_warner.cc:54:18: note: suggested alternative: ‘__getpgid’
   return syscall(__NR_gettid);
                  ^~~~~~~~~~~
                  __getpgi
```

### solve
add `defined(__aarch64__)`
```
// src/yb/gutil/threading/thread_collision_warner.cc
static subtle::Atomic64 CurrentThread() {
#if defined(__APPLE__)
  uint64_t tid;
  CHECK_EQ(0, pthread_threadid_np(NULL, &tid));
  return tid;
#elif defined(__aarch64__)
#include <unistd.h>
  return getpid();
#elif defined(__linux__)
  return syscall(__NR_gettid);
#endif
}
```

## 2.8 protoc-gen-insertions
### error info:
```
make[2]: *** [src/yb/util/CMakeFiles/gen_src_yb_util_version_info_proto.dir/all] Error 2
make[2]: *** Waiting for unfinished jobs....
make[3]: *** [src/yb/util/histogram.pb.cc] Error 1
--insertions_out: protoc-gen-insertions: Plugin killed by signal 11.
make[2]: *** [src/yb/util/CMakeFiles/gen_src_yb_util_histogram_proto.dir/all] Error 2
make[3]: *** [src/yb/fs/fs.pb.cc] Error 1
--insertions_out: protoc-gen-insertions: Plugin killed by signal 11.
```

### solve
https://github.com/yugabyte/yugabyte-db/issues/8928

solve with https://github.com/libunwind/libunwind/pull/244/commits/d1dd1881e69e3bbd69de8d94d5f6fb8fcaa98eba

## 2.9 encryption_util
### error info
```
src/yb/util/encryption_util.cc: In constructor ‘yb::enterprise::OpenSSLInitializer::OpenSSLInitializer()’:
src/yb/util/encryption_util.cc:201:44: error: statement has no effect [-Werror=unused-value]
     CRYPTO_THREADID_set_callback(&ThreadId);
                                            ^
src/yb/util/encryption_util.cc: In destructor ‘yb::enterprise::OpenSSLInitializer::~OpenSSLInitializer()’:
src/yb/util/encryption_util.cc:206:42: error: statement has no effect [-Werror=unused-value]
     CRYPTO_THREADID_set_callback(nullptr);
```

### solve
it could be successfully compiled with openssl-1.0.x, since after 1.1.x these APIs are unimplemented and ineffective. refer to this commit: openssl/openssl@2e52e7d

```
 class OpenSSLInitializer {
@@ -153,12 +155,16 @@ class OpenSSLInitializer {
       crypto_mutexes.emplace_back(std::make_unique<std::mutex>());
     }
     CRYPTO_set_locking_callback(&LockingCallback);
+#if !defined(CRYPTO_THREADID_set_callback)
     CRYPTO_THREADID_set_callback(&ThreadId);
+#endif
   }

   ~OpenSSLInitializer() {
     CRYPTO_set_locking_callback(nullptr);
+#if !defined(CRYPTO_THREADID_set_callback)
     CRYPTO_THREADID_set_callback(nullptr);
+#endif
```

## 3.0 crc
### error info
```
build/release-gcc-dynamic/src/yb/util/CMakeFiles/yb_util.dir/crc.cc.o: In function `yb::crc::InitCrc32cInstance()':
src/yb/util/crc.cc:50: undefined reference to `crcutil_interface::CRC::CreateCrc32c(bool, unsigned long, unsigned long, void const**)'
collect2: error: ld returned 1 exit status
```

### solve
The yugabute thirdparty package `crcutil-440ba7babeff77ffad992df3a10c767f184e946e.tar.gz` doesn't support aarch64, use `https://github.com/cloudera/crcutil.git` to instead


