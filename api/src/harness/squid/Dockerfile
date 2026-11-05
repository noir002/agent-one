# The egress-proxy container egressProxy.js runs per allowlist profile.
# Built from `alpine`, the one base this dev machine already has pulled
# locally — any image not already cached has been failing to pull here
# (TLS verify error on one third-party squid image, then a handshake
# timeout on debian:bookworm-slim), so the fix is to need zero fresh
# pulls at all, not to pick a "more reliable" remote image.
FROM alpine:latest
RUN apk add --no-cache squid
CMD ["squid", "-N", "-f", "/etc/squid/squid.conf"]
