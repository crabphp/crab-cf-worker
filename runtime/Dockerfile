FROM emscripten/emsdk:4.0.20@sha256:460fff8f8ac87e11b16447fbd66538a686eafa0e4fb977aa0989ed19fe2079f7
# Build tools only. No host libraries are linked into PHP. Snapshot prevents apt drift.
RUN printf 'deb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy main universe\ndeb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy-updates main universe\ndeb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy-security main universe\n' > /etc/apt/sources.list \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends autoconf bison re2c pkg-config \
 && rm -rf /var/lib/apt/lists/*
# The SDK's Node 22 cannot instantiate wasm64 tables; use pinned Node 24 for
# build-time PHP execution, opcode generation and initialized-memory snapshots.
RUN curl -fsSL https://nodejs.org/dist/v24.11.1/node-v24.11.1-linux-x64.tar.xz -o /tmp/node.tar.xz \
 && echo '60e3b0a8500819514aca603487c254298cd776de0698d3cd08f11dba5b8289a8  /tmp/node.tar.xz' | sha256sum -c - \
 && mkdir /opt/node && tar -xf /tmp/node.tar.xz -C /opt/node --strip-components=1 \
 && rm /tmp/node.tar.xz
WORKDIR /src
