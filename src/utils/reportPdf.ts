import type { SearchSource } from '../types';

/**
 * Turn a finished research report into a PDF.
 *
 * SIMPLIFICATION: uses the browser's own print engine rather than a PDF
 * library. Zero dependencies, selectable text, real pagination and working
 * links -- at the cost of one "Save as PDF" step in the browser's print
 * dialog. Swap in jsPDF/pdf-lib only if a direct, dialog-free download
 * becomes a requirement; this function's signature would not change.
 */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));

/**
 * Minimal Markdown -> HTML for the subset the report prompt actually emits:
 * headings, bullets, numbered lists, bold, inline code and links. Anything
 * else falls through as a paragraph, which is why every branch escapes first.
 */
const renderMarkdown = (markdown: string): string => {
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) { html.push(`</${list}>`); list = null; }
  };
  const openList = (kind: 'ul' | 'ol') => {
    if (list !== kind) { closeList(); html.push(`<${kind}>`); list = kind; }
  };

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) { closeList(); continue; }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) { openList('ul'); html.push(`<li>${inline(bullet[1])}</li>`); continue; }

    const numbered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numbered) { openList('ol'); html.push(`<li>${inline(numbered[1])}</li>`); continue; }

    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  return html.join('\n');
};

export const openReportPdf = (
  markdown: string,
  sources: SearchSource[] | undefined,
  question: string,
) => {
  const win = window.open('', '_blank');
  if (!win) {
    alert('O browser bloqueou a janela de impressão. Permite popups para este site e tenta novamente.');
    return;
  }

  const generatedAt = new Date().toLocaleString('pt-PT');
  const sourceList = (sources ?? [])
    .map((source, i) => `<li><span class="n">[${i + 1}]</span> ${escapeHtml(source.title || source.url)}<br><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a></li>`)
    .join('');

  win.document.write(`<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Relatório — ${escapeHtml(question.slice(0, 60))}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11.5pt; line-height: 1.6; color: #16150f;
    max-width: 780px; margin: 0 auto; padding: 24px;
  }
  .meta { border-bottom: 2px solid #16150f; padding-bottom: 12px; margin-bottom: 28px; }
  .meta .brand { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; letter-spacing: .18em; text-transform: uppercase; color: #8a8578; }
  .meta .q { font-size: 12pt; margin-top: 6px; }
  .meta .date { font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #8a8578; margin-top: 4px; }
  h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 14px; }
  h2 { font-size: 14pt; margin: 26px 0 8px; border-bottom: 1px solid #ddd9cd; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 18px 0 6px; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 5px; }
  a { color: #8a4a2b; word-break: break-word; }
  code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f2f0e9; padding: 1px 4px; border-radius: 3px; }
  .sources { margin-top: 30px; padding-top: 14px; border-top: 2px solid #16150f; }
  .sources h2 { border: none; margin-top: 0; }
  .sources ol { list-style: none; padding-left: 0; font-size: 10pt; }
  .sources li { margin-bottom: 9px; }
  .sources .n { color: #8a8578; font-family: Helvetica, Arial, sans-serif; }
  .disclaimer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #ddd9cd; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #8a8578; }
  /* Keep headings attached to the text they introduce across page breaks. */
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
  li, p { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="meta">
    <div class="brand">Vuxio · Relatório de investigação</div>
    <div class="q">${escapeHtml(question)}</div>
    <div class="date">Gerado a ${escapeHtml(generatedAt)}</div>
  </div>

  ${renderMarkdown(markdown)}

  ${sourceList ? `<div class="sources"><h2>Fontes consultadas</h2><ol>${sourceList}</ol></div>` : ''}

  <div class="disclaimer">
    Relatório gerado por IA (Vuxio) a partir de pesquisa web automática. Pode conter
    erros ou informação desatualizada — verifica as fontes antes de citar.
  </div>
</body>
</html>`);
  win.document.close();
  // Give the new document a tick to lay out before the print dialog opens,
  // otherwise Chromium can print a blank first page.
  win.onload = () => setTimeout(() => win.print(), 120);
};
