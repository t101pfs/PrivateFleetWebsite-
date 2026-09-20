import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_GROUPS: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😋', '😎', '🤓', '🤔', '🤨', '😐', '🙄', '😏', '😴', '😌', '😔', '😢', '😭', '😤', '😡', '🤯',
      '😳', '🥺', '😱', '😬', '🤗', '🤝', '🙏', '😮‍💨',
    ],
  },
  {
    label: 'Gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '👋', '🤚', '✋', '💪', '🫡', '🫶', '👀',
      '🧠', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯', '🔥', '✨', '🎉', '🎊', '⭐', '💡', '💥',
    ],
  },
  {
    label: 'Work',
    icon: '✅',
    emojis: [
      '✅', '❌', '⚠️', '❗', '❓', '⏰', '⏳', '📌', '📎', '📝', '📄', '📞', '📧', '💬', '📅', '🔔',
      '💰', '💵', '🧾', '📈', '📉', '🔒', '🔑', '🚀', '🎯', '🏆', '👑', '🤝', '🔍', '📊', '🗂️', '⏱️',
    ],
  },
  {
    label: 'Travel',
    icon: '✈️',
    emojis: [
      '✈️', '🛫', '🛬', '🛩️', '🚁', '🌍', '🌎', '🌏', '🗺️', '🧳', '🏨', '🏝️', '🌴', '☀️', '🌤️', '⛅',
      '🌧️', '⛈️', '🌙', '🌅', '🚗', '🚕', '🚢', '⚓', '🛂', '🛃', '🎫', '🍽️', '☕', '🍾', '🥂', '🍰',
    ],
  },
];

interface ChatEmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

/** Small built-in emoji picker for the chat composer (no external library). */
export function ChatEmojiPicker({ onSelect, disabled }: ChatEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const group = EMOJI_GROUPS[groupIndex];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={disabled} aria-label="Add emoji">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-2">
        <div className="flex gap-1 border-b pb-2 mb-2">
          {EMOJI_GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              title={g.label}
              aria-label={g.label}
              onClick={() => setGroupIndex(i)}
              className={cn(
                'flex-1 rounded-md py-1 text-lg hover:bg-secondary',
                i === groupIndex && 'bg-secondary'
              )}
            >
              {g.icon}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
          {group.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="h-8 w-8 rounded-md text-xl leading-none hover:bg-secondary flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
