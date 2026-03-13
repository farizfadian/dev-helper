# ── Dev Helper Dockerfile ──
# Multi-stage build: compile Go binary, then run in minimal image

# Stage 1: Build
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o dev-helper .

# Stage 2: Run
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/dev-helper .
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/static ./static

# Create data directories
RUN mkdir -p files logs notes/attachments snippets prompts

EXPOSE 9090
ENTRYPOINT ["./dev-helper"]
CMD ["--port", "9090"]
