import { getLocale } from './i18n';

/**
 * Author + project data for the "About" page. Pulled once from the real
 * GitHub profiles (`gh api users/<login>`, `gh api users/<login>/repos`) on
 * 2026-08-13, not invented -- see AboutPage/AuthorProjectsPage for how it's
 * rendered. Update by re-running those two calls; nothing here should be
 * hand-edited to "sound better" (that's the fabricated-copy failure the
 * hallmark skill's slop-test gate 46 flags).
 *
 * `role`/`bio`/repo `description` carry both locales rather than routing
 * through src/i18n.ts's flat key dictionary: unlike UI chrome, this content
 * is data about two specific people, keyed by author slug, not a string ID
 * that makes sense pulled out into a global dictionary.
 */

interface Localized {
  pt: string;
  en: string;
}

export interface Repo {
  name: string;
  description: Localized;
  url: string;
  language: string;
  stars: number;
}

export interface Author {
  slug: 'otzpt' | 'coelho';
  name: string;
  role: Localized;
  bio: Localized[];
  avatar: string;
  github: string;
  x?: string;
  repos: Repo[];
}

export const localized = (value: Localized): string => value[getLocale()];

const AUTHORS_DATA: Record<Author['slug'], Author> = {
  otzpt: {
    slug: 'otzpt',
    name: 'otzpt',
    role: { pt: 'Contribuidor principal do VUXIO-AI', en: 'Main contributor to VUXIO-AI' },
    bio: [
      { pt: '16 anos, Portugal', en: '16 years old, Portugal' },
      { pt: 'Overclocking e otimização de sistemas', en: 'Overclocking and system optimization' },
      { pt: 'Linguagem preferida: C', en: 'Favorite language: C' },
    ],
    avatar: 'https://avatars.githubusercontent.com/u/234398432?v=4',
    github: 'https://github.com/otzpt',
    x: 'https://x.com/otzpt_dev',
    repos: [
      { name: 'V-Agent', description: { pt: 'A alternativa sem inchaço aos agentes de IA na cloud. Execução puramente local, sem internet necessária.', en: 'The zero-bloat alternative to cloud-based AI agents. Pure terminal execution, zero internet required.' }, url: 'https://github.com/otzpt/V-Agent', language: 'Rust', stars: 1 },
      { name: 'VOIDTUNE', description: { pt: 'O Windows vem inchado. O VOIDTUNE não. Ajusta CPU, GPU, rede e RAM a partir de uma única UI escura.', en: 'Windows ships bloated. VOIDTUNE doesn’t. Tweak CPU, GPU, network and RAM from one dark UI.' }, url: 'https://github.com/otzpt/VOIDTUNE', language: 'C#', stars: 3 },
      { name: 'VOIDSEED', description: { pt: 'Primeiro modelo LLM escrito de raiz em Python.', en: 'First LLM model written from scratch in Python.' }, url: 'https://github.com/otzpt/VOIDSEED', language: 'Python', stars: 0 },
      { name: 'CodeLearner', description: { pt: 'Cursos de programação em CLI, um por linguagem -- C, C++, Python, JavaScript. Cada um escrito na linguagem que ensina.', en: 'CLI programming courses, one per language -- C, C++, Python, JavaScript. Each written in the language it teaches.' }, url: 'https://github.com/otzpt/CodeLearner', language: 'C', stars: 0 },
      { name: 'Navigation-system', description: { pt: 'Um jogo simples de navegação escrito em C.', en: 'A simple navigation game written in C.' }, url: 'https://github.com/otzpt/Navigation-system', language: 'C', stars: 1 },
      { name: 'CaffeineOS', description: { pt: 'Um WebOS inspirado no Garuda Linux Hyprland.', en: 'A WebOS inspired by Garuda Linux Hyprland.' }, url: 'https://github.com/otzpt/CaffeineOS', language: 'JavaScript', stars: 0 },
      { name: 'vagent-extensions', description: { pt: 'Registo de extensões aberto para o V-Agent -- ferramentas em Python que o agente de IA pode chamar.', en: 'Open extension registry for V-Agent -- Python tools the AI agent can call.' }, url: 'https://github.com/otzpt/vagent-extensions', language: 'Python', stars: 0 },
      { name: 'VOIDBOT', description: { pt: 'Um bot de Slack personalizado, primeiro projeto de aprendizagem em bots, APIs e automação de servidor.', en: 'A custom Slack bot -- first learning project in bot development, APIs and server automation.' }, url: 'https://github.com/otzpt/VOIDBOT', language: 'Python', stars: 0 },
    ],
  },
  coelho: {
    slug: 'coelho',
    name: 'Coelho',
    role: { pt: 'Criador do VUXIO-AI', en: 'Creator of VUXIO-AI' },
    bio: [
      { pt: 'Construiu o VUXIO-AI e o HELIOS, o seu assistente pessoal em Python.', en: 'Built VUXIO-AI and HELIOS, his personal assistant written in Python.' },
    ],
    avatar: 'https://avatars.githubusercontent.com/u/259423275?v=4',
    github: 'https://github.com/coelho26101009-source',
    x: 'https://x.com/SimoCoelho27618',
    repos: [
      { name: 'VUXIO-AI', description: { pt: 'Este assistente.', en: 'This assistant.' }, url: 'https://github.com/coelho26101009-source/VUXIO-AI', language: 'TypeScript', stars: 2 },
      { name: 'HELIOS-AI-ASSISTENT', description: { pt: 'O seu assistente pessoal híbrido em Python.', en: 'His hybrid personal assistant, written in Python.' }, url: 'https://github.com/coelho26101009-source/HELIOS-AI-ASSISTENT', language: 'Python', stars: 1 },
      { name: 'VUXIOCODE', description: { pt: '', en: '' }, url: 'https://github.com/coelho26101009-source/VUXIOCODE', language: 'TypeScript', stars: 0 },
      { name: 'coelho26101009-source.github.io', description: { pt: 'Site pessoal.', en: 'Personal site.' }, url: 'https://github.com/coelho26101009-source/coelho26101009-source.github.io', language: '', stars: 0 },
    ],
  },
};

export const AUTHORS = AUTHORS_DATA;
