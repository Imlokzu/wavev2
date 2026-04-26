import { useMemo } from "react";
import { marked, type MarkedOptions } from "marked";
import DOMPurify from "dompurify";

const markedOpts: MarkedOptions = { breaks: true, async: false };

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface Props {
  content: string;
  onMentionClick?: (username: string) => void;
}

export function MarkdownText({ content, onMentionClick }: Props) {
  const html = useMemo(() => {
    // Spoiler: ||text|| → <span class="spoiler">text</span>
    let processed = content.replace(/\|\|(.+?)\|\|/g, (_, text) => `<span class="spoiler">${escapeHtml(text)}</span>`);
    // @mention → clickable
    processed = processed.replace(/@(\w+)/g, (_, username) => `<button class="mention" data-username="${escapeHtml(username)}">@${escapeHtml(username)}</button>`);
    // Use sync parse and sanitize
    return DOMPurify.sanitize(marked.parse(processed, { ...markedOpts }) as string);
  }, [content]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest(".mention") as HTMLElement | null;
    if (btn && onMentionClick) {
      onMentionClick(btn.dataset.username ?? "");
    }
  };

  return (
    <div
      className="markdown-body min-w-0 max-w-full text-[13px] leading-relaxed text-[#e8e8e8]"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
