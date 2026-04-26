import { useMemo } from "react";

export function useSearch<T extends { id: string; name: string; lastMessage?: string }>(
  items: T[],
  searchQuery: string
): T[] {
  return useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      (item.lastMessage && item.lastMessage.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);
}
