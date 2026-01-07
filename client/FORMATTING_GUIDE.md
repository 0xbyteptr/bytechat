# ByteChat Message Formatting Guide

## Quick Formatting

Click the formatting toolbar buttons above the message input, or use these shortcuts:

### Text Styles

| Style | Syntax | Keyboard |
|-------|--------|----------|
| **Bold** | `**text**` | Ctrl+B |
| *Italic* | `*text*` | Ctrl+I |
| `Code` | `` `code` `` | Ctrl+K |
| ~~Strikethrough~~ | `~~text~~` | — |
| \|\|Spoiler\|\| | `||text||` | — |

### Code Blocks

```markdown
```javascript
const hello = "world"
```
```

The language tag (javascript, python, etc.) is optional.

### Mentions

Use `@username` to mention someone:
- `@alice` - Mentions Alice
- `Hey @bob and @carol, check this out!`
- Mentions are highlighted in messages
- Users in mention-only mode get notified

### Links

Automatic:
- `https://example.com` - Auto-linked

Formatted:
- `[Click here](https://example.com)` - Custom link text

### Quotes

Start a line with `>` to quote:
```
> This is a quoted message
> It can span multiple lines
```

### Escaping

To show formatting symbols literally, use backslash:
- `\*\*not bold\*\*` → \*\*not bold\*\*

## Discord-Like Features

### Message Reactions

Right-click (or long-press on mobile) any message to:
- React with emoji (👍❤️😂😮😢🔥 or more)
- See who reacted
- Remove your reaction

### Message Actions

Right-click any message for:
- **Edit** - Change the message (shows "edited" tag)
- **Delete** - Remove the message
- **Reply** - Quote the message in your response
- **Forward** - Send to another chat
- **Pin** - Save important messages
- **React** - Add emoji reactions

### Message Status

Your messages show:
- ✓ - Sent
- ✓✓ - Read by recipient
- Hover for exact timestamp

### Message Search

Click the 🔍 icon in chat header to search messages in current conversation.

### User Status

- 🟢 Online - User is active
- 🟡 Away - User is idle
- ⚫ Offline - User is offline (shows when they were last seen)

### Notification Modes

Click the bell icon to set notifications for this chat:
- **All Messages** 🔔 - Get notified for every message
- **Mentions Only** @username - Only when you're mentioned
- **Muted** 🔇 - No notifications

## Tips & Tricks

1. **Combine styles**: `***bold italic***`
2. **Mention multiple people**: `@alice @bob @carol`
3. **Hide spoilers**: Use `||spoiler||` for plot twists
4. **Code snippets**: Use single backticks for inline code
5. **Format toolbar**: Click buttons above input field for quick formatting
6. **Hover timestamps**: See exact time when message was sent/read

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+B | Make selected text bold |
| Ctrl+I | Make selected text italic |
| Ctrl+K | Make selected text code |
| Enter | Send message |
| Shift+Enter | New line in message |
| Escape | Cancel edit/reply |

## What's Supported

✅ Text formatting (bold, italic, strikethrough)
✅ Code blocks with syntax highlighting
✅ Links and auto-links
✅ @mentions for users
✅ Emoji reactions
✅ Message editing with history
✅ Message deletion
✅ Quoted replies
✅ Pinned messages
✅ Read receipts
✅ Spoiler hiding
✅ Searchable message history

## Need Help?

Hover over any formatting button to see what it does. The formatting toolbar appears above the message input field and provides one-click formatting.
