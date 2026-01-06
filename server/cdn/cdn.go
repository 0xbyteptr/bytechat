package cdn

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"bytechat/auth"
	"bytechat/storage"
)

var maxFileSize int64 = 50 * 1024 * 1024

// SetMaxFileSize sets the maximum file size for uploads
func SetMaxFileSize(size int64) {
	maxFileSize = size
}

// UploadHandler handles file uploads
func UploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	id := r.Header.Get("X-ByteChat-ID")
	token := r.Header.Get("Authorization")
	if after, ok := strings.CutPrefix(token, "Bearer "); ok {
		token = after
	}

	if !auth.IsValidToken(id, token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize)
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		http.Error(w, "File too large or invalid form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Invalid file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Read error", http.StatusInternalServerError)
		return
	}

	hash := fmt.Sprintf("%x", sha256.Sum256(content))
	ext := filepath.Ext(header.Filename)
	fileName := hash + ext
	filePath := filepath.Join(storage.CDNDir, fileName)

	if err := os.WriteFile(filePath, content, 0644); err != nil {
		http.Error(w, "Save error", http.StatusInternalServerError)
		return
	}

	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	url := fmt.Sprintf("%s://%s/cdn/file/%s", scheme, r.Host, fileName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url":      url,
		"fileName": fileName,
		"hash":     hash,
	})
}

// DownloadHandler handles file downloads
func DownloadHandler(w http.ResponseWriter, r *http.Request) {
	fileName := strings.TrimPrefix(r.URL.Path, "/cdn/file/")
	if fileName == "" {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	filePath := filepath.Join(storage.CDNDir, fileName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	http.ServeFile(w, r, filePath)
}
