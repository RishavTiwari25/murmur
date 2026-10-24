FROM golang:1.26.3-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/murmur-telemetry .

FROM alpine:3.23
RUN addgroup -S murmur && adduser -S -G murmur murmur
COPY --from=builder /out/murmur-telemetry /usr/local/bin/murmur-telemetry
USER murmur
EXPOSE 9091 9090
ENTRYPOINT ["murmur-telemetry"]
