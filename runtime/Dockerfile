FROM emscripten/emsdk:4.0.20@sha256:460fff8f8ac87e11b16447fbd66538a686eafa0e4fb977aa0989ed19fe2079f7
# Build tools only. No host libraries are linked into PHP. Snapshot prevents apt drift.
RUN printf 'deb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy main universe\ndeb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy-updates main universe\ndeb [check-valid-until=no] https://snapshot.ubuntu.com/ubuntu/20251101T000000Z/ jammy-security main universe\n' > /etc/apt/sources.list \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends autoconf bison re2c pkg-config \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
