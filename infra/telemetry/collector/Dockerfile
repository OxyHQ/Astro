FROM docker.io/library/node@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS geoip
COPY collector/fetch-geoip.mjs /fetch-geoip.mjs
RUN node /fetch-geoip.mjs 2026-10 1.0.18 c839d407f85a1e0bddba354cef16b2c398182d1c34ed8d985555dce134b36b14 /dbip-city-lite.mmdb \
 && test "$(stat -c %s /dbip-city-lite.mmdb)" -gt 1000000

FROM docker.io/otel/opentelemetry-collector-contrib@sha256:fd328de2552466ad78385e1b1289c3f2402b1c45f265b252aab1955b42845ac1
COPY --from=geoip /dbip-city-lite.mmdb /etc/otelcol-contrib/dbip-city-lite.mmdb
COPY collector/config.yaml /etc/otelcol-contrib/config.yaml
