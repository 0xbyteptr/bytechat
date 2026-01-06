package middleware

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
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

// CORS middleware
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		w.Header().Set(
			"Access-Control-Allow-Methods",
			"POST, GET, OPTIONS, PUT, DELETE",
		)
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-ByteChat-ID, X-Session-Token",
		)
		w.Header().Set(
			"Access-Control-Allow-Credentials",
			"true",
		)
		w.Header().Set(
			"Access-Control-Max-Age",
			"86400",
		)

		if r.Method == "OPTIONS" {
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
