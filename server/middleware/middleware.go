package middleware

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type statusResponseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *statusResponseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *statusResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("ResponseWriter does not implement http.Hijacker")
	}
	return hijacker.Hijack()
}

// Cache middleware for static content
func Cache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set cache headers for CDN files
		if strings.HasPrefix(r.URL.Path, "/cdn/file/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable") // 1 year for immutable files
		} else if strings.HasPrefix(r.URL.Path, "/health") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		} else {
			// Default: no cache for dynamic content
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}

		next.ServeHTTP(w, r)
	})
}

// CORS middleware
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigins := os.Getenv("CORS_ORIGIN") // comma-separated list or "*"
		if allowedOrigins == "" {
			allowedOrigins = "*"
		}

		allowed := "*"
		if allowedOrigins != "*" && origin != "" {
			for _, o := range strings.Split(allowedOrigins, ",") {
				if strings.TrimSpace(o) == origin {
					allowed = origin
					break
				}
			}
		} else if origin != "" {
			// echo origin by default for non-configured setups
			allowed = origin
		}

		w.Header().Set("Access-Control-Allow-Origin", allowed)
		w.Header().Add("Vary", "Origin")

		// Allow-Methods: echo requested or provide defaults
		reqMethod := r.Header.Get("Access-Control-Request-Method")
		if reqMethod != "" {
			w.Header().Set("Access-Control-Allow-Methods", reqMethod)
		} else {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}

		// Allow-Headers: echo requested or provide defaults
		reqHeaders := r.Header.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			w.Header().Set("Access-Control-Allow-Headers", reqHeaders)
		} else {
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization, X-ByteChat-ID, X-Session-Token")
		}

		// Credentials only if not wildcard and explicitly enabled
		if allowed != "*" && strings.EqualFold(os.Getenv("CORS_ALLOW_CREDENTIALS"), "true") {
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Type, Content-Length")

		if r.Method == "OPTIONS" {
			// Preflight response
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Logging middleware
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		isWS := strings.Contains(strings.ToLower(r.Header.Get("Upgrade")), "websocket")
		if isWS {
			log.Printf("WS_HANDSHAKE %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
			next.ServeHTTP(w, r)
			return
		}

		srw := &statusResponseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(srw, r)

		uri := r.RequestURI
		if strings.Contains(strings.ToLower(uri), "token") {
			u, err := url.ParseRequestURI(uri)
			if err == nil {
				q := u.Query()
				redacted := false
				for key := range q {
					if strings.Contains(strings.ToLower(key), "token") {
						q.Set(key, "REDACTED")
						redacted = true
					}
				}
				if redacted {
					u.RawQuery = q.Encode()
					uri = u.String()
				}
			}
		}
		log.Printf("%s %s %d %s %s", r.Method, uri, srw.status, r.RemoteAddr, time.Since(start))
	})
}
