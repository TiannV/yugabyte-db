<img src="https://www.yugabyte.com/wp-content/uploads/2021/05/yb_horizontal_alt_color_RGB.png" align="center" alt="YugabyteDB" width="50%"/>

---------------------------------------

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Documentation Status](https://readthedocs.org/projects/ansicolortags/badge/?version=latest)](https://docs.yugabyte.com/)
[![Ask in forum](https://img.shields.io/badge/ask%20us-forum-orange.svg)](https://forum.yugabyte.com/)
[![Slack chat](https://img.shields.io/badge/Slack:-%23yugabyte_db-blueviolet.svg?logo=slack)](https://www.yugabyte.com/slack)
[![Analytics](https://yugabyte.appspot.com/UA-104956980-4/home?pixel&useReferer)](https://github.com/yugabyte/ga-beacon)

# compile YB for aarch64

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

# compire errors
## unwind-arch
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
## Compilation options
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

## atomicops
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

## cpu
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
## CycleTimer
### error info
```
src/yb/gutil/cycleclock-inl.h:214:2: error: #error You need to define CycleTimer for your O/S and CPU
 #error You need to define CycleTimer for your O/S and CPU
  ^~~~~
```
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




