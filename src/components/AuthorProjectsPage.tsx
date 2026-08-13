import React from 'react';
import { ArrowLeft, Star, ArrowUpRight } from 'lucide-react';
import { AUTHORS, localized, type Author } from '../authors';
import { t } from '../i18n';

const LANGUAGE_DOT: Record<string, string> = {
  TypeScript: '#3178c6', Python: '#3572A5', Rust: '#dea584', 'C#': '#178600',
  C: '#555555', JavaScript: '#f1e05a',
};

export const AuthorProjectsPage: React.FC<{ author: Author['slug']; onBack: () => void }> = ({ author, onBack }) => {
  const data = AUTHORS[author];
  return (
    <div className="h-screen w-full overflow-y-auto bg-white text-[#1a1917]">
      <header className="flex items-center px-8 py-5">
        <button onClick={onBack} className="flex items-center gap-2 text-[14px] text-[#1a1917]/70 hover:text-[#1a1917] transition-colors">
          <ArrowLeft size={16} /> {t('authors.back')}
        </button>
      </header>

      <main className="px-6 pb-20 pt-6">
        <div className="max-w-[720px] mx-auto">
          <p className="text-[13.5px] text-[#1a1917]/45 mb-3">{t('authors.projectsBreadcrumb', { name: data.name })}</p>

          <div className="flex items-center gap-4 mb-10">
            <img src={data.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
            <div>
              <h1 className="text-[24px] font-bold tracking-[-0.01em]">{data.name}</h1>
              <p className="text-[13px] text-[#1a1917]/45">{t('authors.repos')} · {data.repos.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {data.repos.map(repo => (
              <a
                key={repo.name}
                href={repo.url} target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e6e4e0] hover:border-[#1a1917]/20 hover:bg-[#faf9f7] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold truncate">{repo.name}</h3>
                    <ArrowUpRight size={13} className="shrink-0 text-[#1a1917]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {localized(repo.description) && (
                    <p className="text-[13px] text-[#1a1917]/55 mt-1 leading-relaxed">{localized(repo.description)}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-3 text-[12.5px] text-[#1a1917]/45">
                  {repo.language && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: LANGUAGE_DOT[repo.language] ?? '#8a8578' }} />
                      {repo.language}
                    </span>
                  )}
                  {repo.stars > 0 && (
                    <span className="flex items-center gap-1"><Star size={12} /> {repo.stars}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
