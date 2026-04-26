import { useMemo } from "react";
import { marked, type MarkedOptions } from "marked";
import { useAuthStore } from "@/store/auth-store";

const renderer = new marked.Renderer();
const markedOpts: MarkedOptions = { breaks: true, async: false };

interface Props {
  content: string;
  onMentionClick?: (username: string) => void;
}

export function MarkdownText({ content, onMentionClick }: Props) {
  const currentUser = useAuthStore((s) => s.user);

  const html = useMemo(() => {
    // Spoiler: ||text|| → <span class="spoiler">text</span>
    let processed = content.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
    // @mention → clickable
    processed = processed.replace(/@(\w+)/g, '<button class="mention" data-username="$1">@$1</button>');
    // Use sync parse
    return marked.parse(processed, { ...markedOpts }) as string;
  }, [content]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest(".mention") as HTMLElement | null;
    if (btn && onMentionClick) {
      onMentionClick(btn.dataset.username ?? "");
    }
  };

  return (
    <div
      className="markdown-body text-[13px] leading-relaxed text-[#e8e8e8] break-words"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
