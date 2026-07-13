export function escapeMd(text: string): string {
  if (!text) return text;
  // Escapes characters that are reserved in Telegram Markdown v1
  return text.replace(/([_*`\[])/g, '\\$1');
}
