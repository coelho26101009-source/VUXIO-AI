import type { LogMessage } from '../types';

const visible = (logs: LogMessage[]) => logs.filter(l => l.source !== 'SYSTEM');

export const chatToJson = (logs: LogMessage[]): string =>
  JSON.stringify(
    visible(logs).map(({ source, text, timestamp, sources, usedModel }) => ({ source, text, timestamp, sources, usedModel })),
    null,
    2,
  );

export const chatToMarkdown = (logs: LogMessage[]): string =>
  visible(logs)
    .map(log => {
      const who = log.source === 'USER' ? '**Tu**' : log.source === 'ERROR' ? '**Erro**' : '**VUXIO**';
      const sources = log.sources?.length
        ? '\n\n' + log.sources.map((s, i) => `[${i + 1}] ${s.title || s.url} - ${s.url}`).join('\n')
        : '';
      return `${who} (${log.timestamp})\n\n${log.text}${sources}`;
    })
    .join('\n\n---\n\n');
