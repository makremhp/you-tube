import {
  ArrowLeft,
  ArrowRight,
  CirclePlay,
  Megaphone,
} from 'lucide-react';
import './landing-intro.css';

export type LandingLanguage = 'ar' | 'en';
export type LandingDestination = 'earn' | 'advertise';

type LandingIntroProps = {
  language: LandingLanguage;
  onLanguageChange: (language: LandingLanguage) => void;
  onStart: (destination: LandingDestination) => void;
};

const copy = {
  en: {
    switchLanguage: 'العربية',
    title: 'What would you like to do?',
    subtitle: 'Choose the path that fits you.',
    viewerLabel: 'For viewers',
    viewerTitle: 'I want to earn',
    viewerBody:
      'Watch campaign videos or complete tasks. Check each campaign’s requirements and reward before you take part.',
    viewerButton: 'Start earning',
    advertiserLabel: 'For advertisers',
    advertiserTitle: 'I want to publish an ad',
    advertiserBody:
      'Create a video or social campaign, set its budget and requirements, and publish when it’s ready.',
    advertiserButton: 'Publish an ad',
    note: 'Campaign requirements and rewards vary.',
  },
  ar: {
    switchLanguage: 'English',
    title: 'كيف تريد استخدام VidReward؟',
    subtitle: 'اختر المسار المناسب لك.',
    viewerLabel: 'للمشاهدين',
    viewerTitle: 'أريد أن أربح',
    viewerBody:
      'شاهد فيديوهات الحملات أو أكمل المهام. اطّلع على الشروط والمكافأة قبل المشاركة.',
    viewerButton: 'ابدأ الربح',
    advertiserLabel: 'للمعلنين',
    advertiserTitle: 'أريد نشر إعلان',
    advertiserBody:
      'أنشئ حملة فيديو أو مهمة اجتماعية، وحدد الميزانية والشروط قبل النشر.',
    advertiserButton: 'انشر إعلانك',
    note: 'تختلف الشروط والمكافآت حسب كل حملة.',
  },
} as const;

export function LandingIntro({
  language,
  onLanguageChange,
  onStart,
}: LandingIntroProps) {
  const isArabic = language === 'ar';
  const t = copy[language];
  const DirectionArrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <main
      className={`vr-landing ${isArabic ? 'vr-ar' : 'vr-en'}`}
      dir={isArabic ? 'rtl' : 'ltr'}
      lang={language}
    >
      <header className="vr-header">
        <a className="vr-brand" href="#top" aria-label="VidReward">
          <img src="/assets/vidreward-mark.png" alt="VidReward" />
        </a>
        <button
          className="vr-language"
          type="button"
          onClick={() => onLanguageChange(isArabic ? 'en' : 'ar')}
          data-testid="button-language"
        >
          {t.switchLanguage}
        </button>
      </header>

      <div className="vr-main" id="top">
        <section className="vr-hero">
          <p className="vr-eyebrow">VidReward</p>
          <h1>{t.title}</h1>
          <p className="vr-subtitle">{t.subtitle}</p>
        </section>

        <section className="vr-choices" aria-label={t.title}>
          <article className="vr-choice-card vr-viewer-card">
            <span className="vr-choice-icon" aria-hidden="true">
              <CirclePlay size={24} strokeWidth={1.8} />
            </span>
            <p className="vr-choice-label">{t.viewerLabel}</p>
            <h2>{t.viewerTitle}</h2>
            <p className="vr-choice-body">{t.viewerBody}</p>
            <button
              type="button"
              className="vr-button vr-button-primary"
              onClick={() => onStart('earn')}
              data-testid="button-start-earning"
            >
              {t.viewerButton}
              <DirectionArrow size={17} aria-hidden="true" />
            </button>
          </article>

          <article className="vr-choice-card vr-advertiser-card">
            <span className="vr-choice-icon" aria-hidden="true">
              <Megaphone size={24} strokeWidth={1.8} />
            </span>
            <p className="vr-choice-label">{t.advertiserLabel}</p>
            <h2>{t.advertiserTitle}</h2>
            <p className="vr-choice-body">{t.advertiserBody}</p>
            <button
              type="button"
              className="vr-button vr-button-primary"
              onClick={() => onStart('advertise')}
              data-testid="button-start-advertising"
            >
              {t.advertiserButton}
              <DirectionArrow size={17} aria-hidden="true" />
            </button>
          </article>
        </section>

        <p className="vr-note">{t.note}</p>
      </div>
    </main>
  );
}

export default LandingIntro;