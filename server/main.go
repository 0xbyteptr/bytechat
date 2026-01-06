package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"bytechat/auth"
	"bytechat/cdn"
	"bytechat/groups"
	"bytechat/middleware"
	"bytechat/push"
	"bytechat/storage"
	"bytechat/websocket"

	"github.com/joho/godotenv"
)

var (
	// Max file size (default 50MB)
	maxFileSize int64 = 50 * 1024 * 1024
)

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
	if err := storage.Init(); err != nil {
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
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/challenge", auth.ChallengeHandler)
	mux.HandleFunc("/keys", auth.KeysHandler)
	mux.HandleFunc("/push-token", auth.PushTokenHandler)
	mux.HandleFunc("/groups", groups.Handler)
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
	handler = middleware.Logging(handler)

	fmt.Printf("ByteChat server starting on %s (Max File Size: %d MB)\n", addr, maxFileSize/1024/1024)
	log.Fatal(http.ListenAndServe(addr, handler))
}
