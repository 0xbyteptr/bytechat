package push

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"bytechat/storage"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var (
	fcmClient          *messaging.Client
	fcmApp             *firebase.App
	lastPushTime       = make(map[string]time.Time) // "to:chatId" -> last push time
	lastPushMux        sync.RWMutex
	pushThrottleWindow = 30 * time.Second // Don't send more than 1 push per chat per 30 seconds
)

// Init initializes the push notification service
func Init(credentialsFile string) error {
	opt := option.WithCredentialsFile(credentialsFile)
	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		log.Printf("error initializing firebase app: %v\n", err)
		return err
	}
	fcmApp = app
	client, err := fcmApp.Messaging(context.Background())
	if err != nil {
		log.Printf("error getting messaging client: %v\n", err)
		return err
	}
	fcmClient = client
	return nil
}

// SendPush sends a push notification to a user
func SendPush(to, from, chatId string) {
	token, ok := storage.GetPushToken(to)
	if !ok {
		return
	}

	if fcmClient == nil {
		log.Println("FCM client not initialized, skipping push")
		return
	}

	// Check if we recently sent a push for this chat to this user
	pushKey := fmt.Sprintf("%s:%s", to, chatId)
	lastPushMux.RLock()
	lastTime, exists := lastPushTime[pushKey]
	lastPushMux.RUnlock()

	if exists && time.Since(lastTime) < pushThrottleWindow {
		log.Printf("Throttling push to %s for chat %s (last sent %v ago)\n", to, chatId, time.Since(lastTime))
		return
	}

	message := &messaging.Message{
		Notification: &messaging.Notification{
			Title: "New message",
			Body:  fmt.Sprintf("You have a new message from %s", from),
		},
		Data: map[string]string{
			"senderId": from,
			"chatId":   chatId,
		},
		Token: token,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	response, err := fcmClient.Send(ctx, message)
	if err != nil {
		log.Printf("Error sending push to %s: %v\n", to, err)
		return
	}

	// Update last push time
	lastPushMux.Lock()
	lastPushTime[pushKey] = time.Now()
	lastPushMux.Unlock()

	log.Printf("Successfully sent push message to %s: %s\n", to, response)
}
