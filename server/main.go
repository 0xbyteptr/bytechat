package main

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"bytechat/auth"
	"bytechat/cdn"
	"bytechat/groups"
	"bytechat/middleware"
	"bytechat/profile"
	"bytechat/push"
	"bytechat/storage"
	"bytechat/websocket"

	"github.com/joho/godotenv"
)

var (
	// Max file size (default 50MB)
	maxFileSize int64 = 50 * 1024 * 1024
)

// gzipWriter wraps http.ResponseWriter with gzip compression and preserves Hijacker
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// Gzip middleware for response compression (skip for WebSocket and other upgrade requests)
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't gzip WebSocket upgrades or any upgrade requests
		if r.Header.Get("Upgrade") != "" {
			next.ServeHTTP(w, r)
			return
		}

		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()

		next.ServeHTTP(gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
	})
}

func init() {
	// Try loading from current directory, then from /server directory if we're in the root
	if err := godotenv.Load(); err != nil {
		if err2 := godotenv.Load("server/.env"); err2 == nil {
			log.Println("Loaded .env from server/.env")
		} else {
			log.Println("No .env file found, using system environment variables")
		}
	} else {
		log.Println("Loaded .env from current directory")
	}

	if envMax := os.Getenv("MAX_FILE_SIZE"); envMax != "" {
		if val, err := strconv.ParseInt(envMax, 10, 64); err == nil {
			maxFileSize = val
		}
	}

	// Initialize modules
	if err := storage.InitDB(); err != nil {
		log.Fatal(err)
	}

	if err := auth.Init(); err != nil {
		log.Fatal(err)
	}

	// Initialize Firebase/FCM (optional)
	if err := push.Init("firebase-auth.json"); err != nil {
		log.Printf("Push notifications not initialized: %v\n", err)
	}

	// Set max file size for websocket and cdn
	websocket.SetMaxFileSize(maxFileSize)
	cdn.SetMaxFileSize(maxFileSize)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/challenge", auth.ChallengeHandler)
	mux.HandleFunc("/keys", auth.KeysHandler)
	mux.HandleFunc("/push-token", auth.PushTokenHandler)
	mux.HandleFunc("/groups", groups.Handler)
	mux.HandleFunc("/profile", profile.Handler)
	mux.HandleFunc("/profile/status", profile.StatusHandler)
	mux.HandleFunc("/validate-session", auth.ValidateSessionHandler)
	mux.HandleFunc("/cdn/upload", cdn.UploadHandler)
	mux.HandleFunc("/cdn/file/", cdn.DownloadHandler)
	mux.HandleFunc("/ws", websocket.Handler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	handler := middleware.CORS(mux)
	handler = middleware.Cache(handler)
	handler = gzipMiddleware(handler)
	handler = middleware.Logging(handler)

	// Create server with optimized settings
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Printf("Received signal: %v\n", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Server shutdown error: %v\n", err)
		}
	}()

	fmt.Printf("ByteChat server starting on %s (Max File Size: %d MB)\n", addr, maxFileSize/1024/1024)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	log.Println("Server stopped gracefully")
}
