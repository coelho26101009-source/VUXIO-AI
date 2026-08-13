import React from 'react';
import { t } from '../i18n';

interface LoginScreenProps {
  onLogin: () => void;
  onGuest: () => void;
  onOpenAbout: () => void;
  isAuthBusy?: boolean;
  authError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGuest, onOpenAbout, isAuthBusy = false, authError = null }) => {
  return (
    <div className="h-screen w-full overflow-y-auto bg-white text-[#1a1917]">
      {/* ── Top bar. Grid, not flex justify-between: the wordmark and the
          guest button have different widths, so justify-between visually
          off-centers a 3-child nav in the middle slot -- grid's center
          column centers on the viewport regardless of sibling width. ── */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-8 py-5">
        <img src="/logovuxio.png" alt={t('login.wordmark')} className="h-10 w-auto" />

        <nav className="hidden md:flex items-center gap-8 text-[14px] text-[#1a1917]/70">
          <button onClick={onOpenAbout} className="hover:text-[#1a1917] transition-colors">{t('login.nav.about')}</button>
          <a href="https://github.com/coelho26101009-source/VUXIO-AI" target="_blank" rel="noopener noreferrer" className="hover:text-[#1a1917] transition-colors">{t('login.nav.code')}</a>
          <a href="https://github.com/coelho26101009-source/VUXIO-AI/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer" className="hover:text-[#1a1917] transition-colors">{t('login.nav.privacy')}</a>
        </nav>

        <div />
      </header>

      {/* ── Hero ── */}
      <main className="px-6 pb-20">
        <div className="max-w-[900px] mx-auto text-center pt-16">
          <p className="text-[13.5px] text-[#1a1917]/45 mb-6">
            {t('login.breadcrumb')}
          </p>

          <h1 className="text-[44px] md:text-[52px] leading-[1.1] font-bold tracking-[-0.02em] max-w-[15ch] mx-auto">
            {t('login.headline')}
          </h1>

          <p className="mt-6 text-[16px] leading-relaxed text-[#1a1917]/60 max-w-[52ch] mx-auto">
            {t('login.subhead')}
          </p>

          <div className="flex items-center justify-center gap-3 mt-9">
            <button
              onClick={onLogin}
              disabled={isAuthBusy}
              className="px-6 py-3 rounded-xl text-[14.5px] font-medium bg-[#1a1917] text-white hover:bg-[#33302c] transition-[background-color,transform] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{ transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--ease-out)' }}
            >
              {isAuthBusy ? t('login.googleCtaBusy') : t('login.googleCta')}
            </button>
            <button
              onClick={onGuest}
              disabled={isAuthBusy}
              className="px-6 py-3 rounded-xl text-[14.5px] font-medium bg-[#f0efec] hover:bg-[#e6e4e0] transition-colors disabled:opacity-50"
            >
              {t('login.guestCta')}
            </button>
          </div>

          {authError && (
            <div className="mt-6 mx-auto max-w-md px-4 py-3 rounded-xl text-[13px] leading-relaxed bg-red-50 border border-red-200 text-red-800">
              {authError}
            </div>
          )}
        </div>

        {/* ── Hero panel ── */}
        <div className="max-w-[1040px] mx-auto mt-14 rounded-3xl bg-[#f4f3f0] overflow-hidden">
          <div className="px-8 md:px-14 py-14 grid md:grid-cols-3 gap-10">
            <div>
              <h3 className="text-[16px] font-semibold mb-2">{t('login.feature.code.title')}</h3>
              <p className="text-[14px] leading-relaxed text-[#1a1917]/60">
                {t('login.feature.code.body')}
              </p>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold mb-2">{t('login.feature.web.title')}</h3>
              <p className="text-[14px] leading-relaxed text-[#1a1917]/60">
                {t('login.feature.web.body')}
              </p>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold mb-2">{t('login.feature.memory.title')}</h3>
              <p className="text-[14px] leading-relaxed text-[#1a1917]/60">
                {t('login.feature.memory.bodyPrefix')}
                {' '}<code className="font-mono text-[13px] bg-[#e6e4e0] px-1.5 py-0.5 rounded">/remember</code>
                {' '}{t('login.feature.memory.bodySuffix')}
              </p>
            </div>
          </div>
        </div>

        {/* GDPR (Art. 13): both paths stated together -- the guest line alone
            reads as reassurance, so the account line sits beside it. */}
        <div className="max-w-[1040px] mx-auto mt-8 text-center space-y-1">
          <p className="text-[13px] text-[#1a1917]/45">
            {t('login.noticeGuest')}
          </p>
          <p className="text-[13px] text-[#1a1917]/45">
            {t('login.noticeAccount')}
          </p>
        </div>
      </main>
    </div>
  );
};
