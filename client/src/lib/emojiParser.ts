import twemoji from 'twemoji'

// Emoji shortcode mappings
const emojiMap: Record<string, string> = {
  // Smileys & emotions
  ':smile:': '😄',
  ':grin:': '😁',
  ':joy:': '😂',
  ':smiley:': '😃',
  ':sweat_smile:': '😅',
  ':laughing:': '😆',
  ':satisfied:': '😆',
  ':innocent:': '😇',
  ':smiling_imp:': '😈',
  ':wink:': '😉',
  ':blush:': '😊',
  ':slightly_smiling_face:': '🙂',
  ':upside_down_face:': '🙃',
  ':relaxed:': '☺️',
  ':yum:': '😋',
  ':relieved:': '😌',
  ':heart_eyes:': '😍',
  ':kissing_heart:': '😘',
  ':kissing:': '😗',
  ':kissing_smiling_eyes:': '😙',
  ':kissing_closed_eyes:': '😚',
  ':stuck_out_tongue:': '😛',
  ':stuck_out_tongue_winking_eye:': '😜',
  ':stuck_out_tongue_closed_eyes:': '😝',
  ':money_mouth_face:': '🤑',
  ':nerd_face:': '🤓',
  ':sunglasses:': '😎',
  ':clown_face:': '🤡',
  ':hugging_face:': '🤗',
  ':smirk:': '😏',
  ':no_mouth:': '😶',
  ':neutral_face:': '😐',
  ':expressionless:': '😑',
  ':unamused:': '😒',
  ':roll_eyes:': '🙄',
  ':thinking:': '🤔',
  ':lying_face:': '🤥',
  ':hand_over_mouth:': '🤭',
  ':shushing_face:': '🤫',
  ':symbols:': '🔣',
  ':silenced:': '🤐',
  ':dizzy_face:': '😵',
  ':zipper_mouth_face:': '🤐',
  ':cowboy_hat_face:': '🤠',
  ':money_face:': '🤑',
  ':hugs:': '🤗',
  ':frowning2:': '🙁',
  ':anguished:': '😧',
  ':ugh:': '😒',
  ':sob:': '😭',
  ':cry:': '😢',
  ':disappointed:': '😞',
  ':worried:': '😟',
  ':angry:': '😠',
  ':rage:': '😡',
  ':pensive:': '😔',
  ':confused:': '😕',
  ':slightly_frowning_face:': '🙁',
  ':frowning_face:': '☹️',
  ':persevere:': '😣',
  ':confounded:': '😖',
  ':tired_face:': '😫',
  ':weary:': '😩',
  ':pleading_face:': '🥺',
  ':triumph:': '😤',
  ':open_mouth:': '😮',
  ':scream:': '😱',
  ':fearful:': '😨',
  ':cold_sweat:': '😰',
  ':hushed:': '😯',
  ':flushed:': '😳',
  ':astonished:': '😲',
  ':facepalm:': '🤦',
  ':poop:': '💩',
  ':smiling_cat:': '😸',
  ':joy_cat:': '😹',
  ':smiley_cat:': '😻',
  ':heart_eyes_cat:': '😻',
  ':smirk_cat:': '😼',
  ':kissing_cat:': '😽',
  ':pouting_cat:': '😾',
  ':crying_cat_face:': '😿',
  ':scream_cat:': '🙀',

  // Hand gestures
  ':+1:': '👍',
  ':thumbsup:': '👍',
  ':-1:': '👎',
  ':thumbsdown:': '👎',
  ':fist:': '✊',
  ':punch:': '👊',
  ':fist_raised:': '✊',
  ':v:': '✌️',
  ':ok_hand:': '👌',
  ':open_hands:': '👐',
  ':palms_up_together:': '🤲',
  ':writing_hand:': '✍️',
  ':nail_care:': '💅',
  ':love_you_gesture:': '🤟',
  ':metal:': '🤘',
  ':call_me_hand:': '🤙',
  ':point_left:': '👈',
  ':point_right:': '👉',
  ':point_up_2:': '👆',
  ':point_down:': '👇',
  ':point_up:': '☝️',
  ':wave:': '👋',
  ':raised_hand:': '✋',
  ':raised_hand_with_fingers_splayed:': '🖐️',
  ':hand:': '✋',
  ':raised_back_of_hand:': '🤚',
  ':raised_hand_with_part_between_middle_and_ring_fingers:': '🖖',
  ':pray:': '🙏',

  // Hearts & love
  ':heart:': '❤️',
  ':yellow_heart:': '💛',
  ':blue_heart:': '💙',
  ':purple_heart:': '💜',
  ':green_heart:': '💚',
  ':broken_heart:': '💔',
  ':heartbeat:': '💓',
  ':heartpulse:': '💗',
  ':cupid:': '💘',
  ':gift_heart:': '💝',
  ':sparkling_heart:': '💖',
  ':revolving_hearts:': '💞',
  ':heart_decoration:': '💟',
  ':peace_symbol:': '☮️',

  // Objects & symbols
  ':fire:': '🔥',
  ':sparkles:': '✨',
  ':star:': '⭐',
  ':tada:': '🎉',
  ':confetti_ball:': '🎊',
  ':gift:': '🎁',
  ':balloon:': '🎈',
  ':bomb:': '💣',
  ':skull:': '💀',
  ':coffin:': '⚰️',
  ':rose:': '🌹',
  ':sunflower:': '🌻',
  ':corn:': '🌽',
  ':pizza:': '🍕',
  ':cake:': '🍰',
  ':beer:': '🍺',
  ':coffee:': '☕',
  ':sun:': '☀️',
  ':moon:': '🌙',
  ':umbrella:': '☔',
  ':cloud:': '☁️',
  ':snowman:': '☃️',
  ':watch:': '⌚',
  ':hourglass:': '⌛',
  ':alarm_clock:': '⏰',
  ':hourglass_flowing_sand:': '⏳',
  ':mag:': '🔍',
  ':mag_right:': '🔎',
  ':lock:': '🔒',
  ':unlock:': '🔓',
  ':bell:': '🔔',
  ':bulb:': '💡',
  ':flashlight:': '🔦',
  ':candle:': '🕯️',
  ':wastebasket:': '🗑️',
  ':bathroom:': '🚻',
  ':money_with_wings:': '💸',
  ':moneybag:': '💰',
  ':dollar:': '💵',
  ':yen:': '💴',
  ':euro:': '💶',
  ':pound:': '💷',
  ':heavy_check_mark:': '✔️',
  ':x:': '❌',
  ':heavy_multiplication_x:': '✖️',
  ':heavy_plus_sign:': '➕',
  ':heavy_minus_sign:': '➖',
  ':heavy_division_sign:': '➗',
  ':bangbang:': '‼️',
  ':interrobang:': '⁉️',
  ':question:': '❓',
  ':exclamation:': '❗',
  ':100:': '💯',
  ':grey_exclamation:': '❕',
  ':grey_question:': '❔',
  ':zzz:': '💤',
  ':dash:': '💨',
  ':sweat_drops:': '💦',
  ':droplet:': '💧',
  ':boom:': '💥',
  ':collision:': '💥',
  ':hankey:': '💩',
  ':muscle:': '💪',
  ':dizzy:': '💫',
  ':speech_balloon:': '💬',
  ':thought_balloon:': '💭',

  // Hand signs
  ':ok:': '🆗',
  ':cool:': '🆒',
  ':new:': '🆕',
  ':free:': '🆓',

  // Numbers
  ':keycap_1:': '1️⃣',
  ':keycap_2:': '2️⃣',
  ':keycap_3:': '3️⃣',
  ':keycap_4:': '4️⃣',
  ':keycap_5:': '5️⃣',
  ':keycap_6:': '6️⃣',
  ':keycap_7:': '7️⃣',
  ':keycap_8:': '8️⃣',
  ':keycap_9:': '9️⃣',
  ':keycap_0:': '0️⃣',
}

/**
 * Parse emoji shortcodes (like :smile:) and render them as emoji
 * Also applies twemoji rendering for proper emoji display
 */
export function parseEmoji(text: string): string {
  if (!text) return text

  // Replace shortcodes with actual emoji
  let result = text
  for (const [code, emoji] of Object.entries(emojiMap)) {
    result = result.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji)
  }

  // Apply twemoji to render emoji as SVG/PNG (optional, for consistent rendering)
  // This step is optional and can be done in the component instead
  return result
}

/**
 * Parse emoji and return HTML with twemoji rendering
 * Use this when you need the HTML directly
 */
export function parseEmojiToHTML(text: string): string {
  const parsed = parseEmoji(text)
  return twemoji.parse(parsed, {
    folder: 'svg',
    ext: '.svg'
  })
}

/**
 * Just apply twemoji rendering to existing emoji
 */
export function renderEmoji(text: string): string {
  return twemoji.parse(text, {
    folder: 'svg',
    ext: '.svg'
  })
}
