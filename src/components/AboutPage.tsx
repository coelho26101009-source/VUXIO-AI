import React from 'react';
import { ArrowLeft, Github, ArrowUpRight } from 'lucide-react';
import { AUTHORS, localized, type Author } from '../authors';
import { t } from '../i18n';

/** Inline X (Twitter) mark -- lucide has no X/Twitter icon since the rebrand,
 *  and pulling a whole icon pack in for one glyph isn't worth it. No text
 *  label next to it (unlike the GitHub button): the mark already reads as
 *  "X", so a literal "X" next to its own icon just doubled up. */
const XMark: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20Z" />
  </svg>
);

const AuthorCard: React.FC<{ author: Author; onViewProjects: () => void }> = ({ author, onViewProjects }) => (
  <div className="w-full max-w-[320px] rounded-2xl border border-[#e6e4e0] bg-[#faf9f7] p-7 flex flex-col items-center text-center">
    <img src={author.avatar} alt="" className="w-20 h-20 rounded-full object-cover mb-4" />
    <h3 className="text-[18px] font-semibold">{author.name}</h3>
    <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#d97757] mt-1 mb-4">{localized(author.role)}</p>

    <div className="space-y-1 mb-6">
      {author.bio.map(line => (
        <p key={line.en} className="text-[13px] text-[#1a1917]/55 leading-relaxed">{localized(line)}</p>
      ))}
    </div>

    <div className="flex items-center gap-2 mb-3 w-full">
      <a
        href={author.github} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium bg-[#1a1917] text-white hover:bg-[#33302c] transition-colors"
      >
        <Github size={15} /> GitHub
      </a>
      {author.x && (
        <a
          href={author.x} target="_blank" rel="noopener noreferrer"
          aria-label="X"
          className="w-11 flex items-center justify-center py-2.5 rounded-xl border border-[#e6e4e0] hover:bg-[#f0efec] transition-colors"
        >
          <XMark size={15} />
        </a>
      )}
    </div>

    <button
      onClick={onViewProjects}
      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium text-[#1a1917]/60 hover:text-[#1a1917] hover:bg-[#f0efec] transition-colors"
    >
      {t('authors.viewProjects')} <ArrowUpRight size={13} />
    </button>
  </div>
);

/** One page: what Vuxio is, and who built it -- the user asked for these
 *  merged rather than split across an "About" and a separate "Author" link,
 *  so the two live as sections of the same page instead of two routes. */
export const AboutPage: React.FC<{ onBack: () => void; onViewProjects: (slug: Author['slug']) => void }> = ({ onBack, onViewProjects }) => (
  <div className="h-screen w-full overflow-y-auto bg-white text-[#1a1917]">
    <header className="flex items-center px-8 py-5">
      <button onClick={onBack} className="flex items-center gap-2 text-[14px] text-[#1a1917]/70 hover:text-[#1a1917] transition-colors">
        <ArrowLeft size={16} /> {t('authors.back')}
      </button>
    </header>

    <main className="px-6 pb-20 pt-6">
      <div className="max-w-[640px] mx-auto">
        <p className="text-[13.5px] text-[#1a1917]/45 mb-3">{t('about.breadcrumb')}</p>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] mb-6">{t('about.title')}</h1>
        <p className="text-[16px] leading-relaxed text-[#1a1917]/65 mb-4">{t('about.body1')}</p>
        <p className="text-[16px] leading-relaxed text-[#1a1917]/65">{t('about.body2')}</p>
      </div>

      <div className="max-w-[720px] mx-auto mt-16 pt-16 border-t border-[#e6e4e0]">
        <h2 className="text-[22px] font-bold tracking-[-0.01em] text-center mb-10">{t('authors.title')}</h2>
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-6">
          <AuthorCard author={AUTHORS.coelho} onViewProjects={() => onViewProjects('coelho')} />
          <AuthorCard author={AUTHORS.otzpt} onViewProjects={() => onViewProjects('otzpt')} />
        </div>

        {/* Art. 50(1)/52 AI Act + trust: which AI tool actually helped build
            this, stated plainly rather than buried -- not a generic
            "AI-assisted" badge, the specific tool. */}
        <div className="mt-10 pt-8 border-t border-[#e6e4e0] text-center">
          <p className="text-[12.5px] text-[#1a1917]/40">
            {t('authors.builtWith')}{' '}
            <a href="https://www.anthropic.com/claude-code" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1a1917] transition-colors">
              Claude Code
            </a>
            {' '}(Anthropic).
          </p>
        </div>
      </div>
    </main>
  </div>
);
