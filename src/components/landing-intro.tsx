import { useEffect } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CirclePlay,
  Clapperboard,
  Coins,
  Compass,
  Eye,
  FileVideo2,
  MousePointer2,
  Play,
  Sparkles,
  Wallet,
} from 'lucide-react';
import './landing-intro.css';

export type LandingLanguage = 'ar' | 'en';

type LandingIntroProps = {
  language: LandingLanguage;
  onLanguageChange: (language: LandingLanguage) => void;
  onStart: () => void;
};

const copy = {
  en: {
    switchLanguage: 'Arabic',
    eyebrow: 'A better way to spend your watch time',
    heroTitle: <>Watch with purpose.<br /><em>Earn along the way.</em></>,
    heroBody:
      'Choose from video campaigns and social tasks. Watch eligible videos or complete TikTok and Telegram tasks, with each campaign showing its steps and reward before you join.',
    primary: 'Start earning',
    secondary: 'See how it works',
    note: 'No promises of fixed earnings. Every campaign sets its own requirements and reward.',
    heroPill: 'Your next watch can go further',
    proofTop: 'A clear path, from video to reward',
    proofBottom: 'Built for viewers and the people behind the videos.',
    introKicker: 'Two sides. One simple idea.',
    introTitle: <>Make every campaign<br />work for <em>everyone.</em></>,
    introBody:
      'VidReward brings creators and curious viewers together around video campaigns with clear steps and visible rewards.',
    viewerLabel: 'For viewers',
    viewerTitle: 'Find campaigns worth your time.',
    viewerBody:
      'Watch available campaign videos or complete TikTok and Telegram tasks. Check each campaign’s requirements and reward before taking part.',
    viewerPoints: ['Watch videos in active campaigns', 'Complete TikTok or Telegram tasks', 'Track eligible rewards and progress'],
    creatorLabel: 'For creators',
    creatorTitle: 'Give your next video a launchpad.',
    creatorBody:
      'Launch a YouTube video, TikTok follow, or Telegram channel campaign. Set its participation requirements and budget, then publish when it is ready.',
    creatorPoints: ['Choose a video or social campaign', 'Set requirements, budget, and campaign details', 'Track reach and completed activity'],
    processKicker: 'A little more clarity at every step',
    processTitle: 'From first play to what’s next.',
    processBody: 'The experience stays simple: understand the brief, take part, and know where you stand.',
    stepOne: 'Discover',
    stepOneBody: 'Choose a video campaign that fits your interests.',
    stepTwo: 'Take part',
    stepTwoBody: 'Watch the video or complete the requested social task.',
    stepThree: 'Collect',
    stepThreeBody: 'See eligible rewards and your progress in one place.',
    clarityKicker: 'Clear by design',
    clarityTitle: 'Know what you’re signing up for.',
    clarityBody:
      'Campaign details are there to help you make an informed choice. Requirements and rewards can vary from one campaign to another, so you can decide what works for you before you begin.',
    clarityMeta: 'Transparent campaign details',
    clarityChip1: 'Participation steps',
    clarityChip2: 'Reward information',
    clarityChip3: 'Progress at a glance',
    finalEyebrow: 'Your next chapter starts with a play',
    finalTitle: <>Good videos bring people together.<br /><em>Good campaigns give them a reason.</em></>,
    finalBody: 'Join VidReward and explore a more rewarding way to connect through video.',
    footer: 'Video campaigns, with a little more in them.',
    start: 'Start earning',
  },
  ar: {
    switchLanguage: 'الإنجليزية',
    eyebrow: 'طريقة أفضل للاستفادة من وقت المشاهدة',
    heroTitle: <>شاهد بهدف.<br /><em>واكسب في طريقك.</em></>,
    heroBody:
      'اختر من حملات الفيديو والمهام الاجتماعية. شاهد الفيديوهات المؤهلة أو أكمل مهام تيك توك وتيليغرام، وتعرّف على الخطوات والمكافأة قبل المشاركة.',
    primary: 'ابدأ الربح',
    secondary: 'اكتشف كيف تعمل',
    note: 'لا توجد أرباح مضمونة. لكل حملة متطلباتها ومكافآتها الخاصة.',
    heroPill: 'مشاهدتك القادمة قد تمنحك أكثر',
    proofTop: 'طريق واضح من الفيديو إلى المكافأة',
    proofBottom: 'منصة للمشاهدين ولصنّاع الفيديو.',
    introKicker: 'طرفان. فكرة واحدة بسيطة.',
    introTitle: <>حملة تفيد<br /><em>الجميع.</em></>,
    introBody:
      'تجمع VidReward صنّاع المحتوى والمشاهدين حول حملات فيديو بخطوات واضحة ومكافآت ظاهرة.',
    viewerLabel: 'للمشاهدين',
    viewerTitle: 'اختر حملات تستحق وقتك.',
    viewerBody:
      'شاهد فيديوهات الحملات المتاحة أو أكمل مهام تيك توك وتيليغرام. اطّلع على شروط كل حملة ومكافأتها قبل المشاركة.',
    viewerPoints: ['شاهد الفيديوهات ضمن الحملات المتاحة', 'أكمل مهام تيك توك أو تيليغرام', 'تابع المكافآت المؤهلة وتقدمك'],
    creatorLabel: 'لصنّاع المحتوى',
    creatorTitle: 'امنح فيديوك انطلاقة جديدة.',
    creatorBody:
      'أنشئ حملة لمشاهدة فيديو على يوتيوب، أو لمتابعة حساب تيك توك، أو للاشتراك في قناة تيليغرام. حدد متطلبات المشاركة والميزانية قبل النشر.',
    creatorPoints: ['اختر حملة فيديو أو حملة اجتماعية', 'حدد الشروط والميزانية وتفاصيل الحملة', 'تابع الوصول والأنشطة المكتملة'],
    processKicker: 'وضوح أكثر في كل خطوة',
    processTitle: 'من أول مشاهدة إلى الخطوة التالية.',
    processBody: 'تجربة بسيطة: افهم الحملة، شارك، وتابع تقدمك.',
    stepOne: 'اكتشف',
    stepOneBody: 'اختر حملة فيديو تناسب اهتماماتك.',
    stepTwo: 'شارك',
    stepTwoBody: 'شاهد الفيديو أو أكمل المهمة الاجتماعية المطلوبة.',
    stepThree: 'تابع مكافآتك',
    stepThreeBody: 'اطّلع على المكافآت المؤهلة وتقدمك في مكان واحد.',
    clarityKicker: 'الوضوح أساس التجربة',
    clarityTitle: 'اعرف التفاصيل قبل أن تبدأ.',
    clarityBody:
      'تساعدك تفاصيل الحملة على اتخاذ قرار مناسب. قد تختلف المتطلبات والمكافآت من حملة إلى أخرى، لتختار ما يناسبك قبل المشاركة.',
    clarityMeta: 'تفاصيل واضحة لكل حملة',
    clarityChip1: 'خطوات المشاركة',
    clarityChip2: 'معلومات المكافأة',
    clarityChip3: 'متابعة التقدم',
    finalEyebrow: 'خطوتك التالية تبدأ بمشاهدة',
    finalTitle: <>الفيديو يجمع الناس.<br /><em>والحملة تمنحهم سبباً للمشاركة.</em></>,
    finalBody: 'انضم إلى VidReward واكتشف طريقة أكثر فائدة للتواصل عبر الفيديو.',
    footer: 'حملات فيديو، بقيمة أكبر للجميع.',
    start: 'ابدأ الربح',
  },
} as const;

export function LandingIntro({ language, onLanguageChange, onStart }: LandingIntroProps) {
  const t = copy[language];
  const isArabic = language === 'ar';

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.vr-reveal');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('vr-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('vr-visible');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [language]);

  const DirectionArrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <main className={`vr-landing ${isArabic ? 'vr-ar' : 'vr-en'}`} dir={isArabic ? 'rtl' : 'ltr'} lang={language}>
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
          <span className="vr-language-dot" aria-hidden="true" />
          {t.switchLanguage}
        </button>
      </header>

      <section className="vr-hero" id="top">
        <div className="vr-hero-copy">
          <div className="vr-eyebrow vr-enter"><span className="vr-eyebrow-mark"><Play size={11} fill="currentColor" /></span>{t.eyebrow}</div>
          <h1 className="vr-enter vr-delay-1">{t.heroTitle}</h1>
          <p className="vr-hero-body vr-enter vr-delay-2">{t.heroBody}</p>
          <div className="vr-hero-actions vr-enter vr-delay-3">
            <button type="button" className="vr-button vr-button-primary" onClick={onStart} data-testid="button-start-earning">
              {t.primary}<DirectionArrow size={17} strokeWidth={2.2} />
            </button>
            <a className="vr-text-link" href="#how-it-works">{t.secondary}<ArrowDown size={15} /></a>
          </div>
          <p className="vr-note vr-enter vr-delay-3"><BadgeCheck size={15} />{t.note}</p>
        </div>

        <div className="vr-hero-art vr-enter vr-delay-2" aria-label={t.proofTop}>
          <div className="vr-art-wash" />
          <div className="vr-orbit vr-orbit-one" />
          <div className="vr-orbit vr-orbit-two" />
          <div className="vr-art-mark">
            <img src="/assets/vidreward-mark.png" alt="" />
          </div>
          <div className="vr-float-card vr-float-view">
            <span className="vr-float-icon"><CirclePlay size={19} /></span>
            <span><strong>{t.viewerLabel}</strong><small>{t.stepOne}</small></span>
            <span className="vr-mini-arrow"><ArrowUpRight size={15} /></span>
          </div>
          <div className="vr-float-card vr-float-reward">
            <span className="vr-float-icon vr-coin-icon"><Coins size={19} /></span>
            <span><strong>{t.proofTop}</strong><small>{t.proofBottom}</small></span>
          </div>
          <div className="vr-art-caption"><span className="vr-caption-line" />{t.heroPill}</div>
        </div>
      </section>

      <div className="vr-ribbon" aria-hidden="true">
        <span><Play size={12} fill="currentColor" /> {t.proofTop}</span>
        <i />
        <span><Sparkles size={13} /> {t.proofBottom}</span>
        <i />
        <span><Play size={12} fill="currentColor" /> {t.proofTop}</span>
      </div>

      <section className="vr-intro vr-section vr-reveal">
        <div className="vr-section-heading">
          <p className="vr-kicker">{t.introKicker}</p>
          <h2>{t.introTitle}</h2>
        </div>
        <p className="vr-intro-copy">{t.introBody}</p>
      </section>

      <section className="vr-audiences vr-section">
        <article className="vr-audience-card vr-viewer-card vr-reveal">
          <div className="vr-card-topline"><span className="vr-card-index">01</span><span className="vr-card-icon"><Eye size={20} /></span></div>
          <p className="vr-kicker">{t.viewerLabel}</p>
          <h3>{t.viewerTitle}</h3>
          <p className="vr-card-body">{t.viewerBody}</p>
          <ul>{t.viewerPoints.map((point, index) => <li key={point}><span className="vr-check">{index + 1}</span>{point}</li>)}</ul>
          <div className="vr-viewer-visual"><div className="vr-video-window"><div className="vr-video-shape" /><div className="vr-play-disc"><Play size={18} fill="currentColor" /></div><div className="vr-video-progress"><span /></div></div><span className="vr-visual-label"><CirclePlay size={14} />{t.stepOne}</span></div>
        </article>

        <article className="vr-audience-card vr-creator-card vr-reveal">
          <div className="vr-card-topline"><span className="vr-card-index">02</span><span className="vr-card-icon"><Clapperboard size={20} /></span></div>
          <p className="vr-kicker">{t.creatorLabel}</p>
          <h3>{t.creatorTitle}</h3>
          <p className="vr-card-body">{t.creatorBody}</p>
          <ul>{t.creatorPoints.map((point, index) => <li key={point}><span className="vr-check">{index + 1}</span>{point}</li>)}</ul>
          <div className="vr-creator-visual"><div className="vr-creator-panel"><span className="vr-panel-icon"><FileVideo2 size={19} /></span><div className="vr-panel-lines"><i /><i /><i /></div><span className="vr-panel-launch"><ArrowUpRight size={15} /></span></div><div className="vr-creator-track"><span /><span /><span /><span /><span /><span /><span /></div><span className="vr-visual-label"><MousePointer2 size={14} />{t.creatorLabel}</span></div>
        </article>
      </section>

      <section className="vr-process vr-section vr-reveal" id="how-it-works">
        <div className="vr-process-heading">
          <div><p className="vr-kicker">{t.processKicker}</p><h2>{t.processTitle}</h2></div>
          <p>{t.processBody}</p>
        </div>
        <div className="vr-steps">
          <article className="vr-step"><span className="vr-step-no">01</span><span className="vr-step-icon"><Compass size={22} /></span><h3>{t.stepOne}</h3><p>{t.stepOneBody}</p></article>
          <span className="vr-step-connector" aria-hidden="true"><DirectionArrow size={18} /></span>
          <article className="vr-step"><span className="vr-step-no">02</span><span className="vr-step-icon"><CirclePlay size={22} /></span><h3>{t.stepTwo}</h3><p>{t.stepTwoBody}</p></article>
          <span className="vr-step-connector" aria-hidden="true"><DirectionArrow size={18} /></span>
          <article className="vr-step"><span className="vr-step-no">03</span><span className="vr-step-icon"><Wallet size={22} /></span><h3>{t.stepThree}</h3><p>{t.stepThreeBody}</p></article>
        </div>
      </section>

      <section className="vr-clarity vr-section vr-reveal">
        <div className="vr-clarity-visual">
          <div className="vr-clarity-ring vr-ring-back" />
          <div className="vr-clarity-ring vr-ring-front" />
          <div className="vr-clarity-token"><BadgeCheck size={35} strokeWidth={1.5} /></div>
          <div className="vr-clarity-label vr-label-a"><span /><span /><span /></div>
          <div className="vr-clarity-label vr-label-b"><i /><i /><i /><i /></div>
          <div className="vr-clarity-caption"><Sparkles size={14} />{t.clarityMeta}</div>
        </div>
        <div className="vr-clarity-copy">
          <p className="vr-kicker">{t.clarityKicker}</p>
          <h2>{t.clarityTitle}</h2>
          <p>{t.clarityBody}</p>
          <div className="vr-chips"><span>{t.clarityChip1}</span><span>{t.clarityChip2}</span><span>{t.clarityChip3}</span></div>
        </div>
      </section>

      <section className="vr-final vr-reveal">
        <div className="vr-final-orb vr-final-orb-a" />
        <div className="vr-final-orb vr-final-orb-b" />
        <div className="vr-final-content">
          <p className="vr-final-eyebrow"><span />{t.finalEyebrow}</p>
          <h2>{t.finalTitle}</h2>
          <p>{t.finalBody}</p>
          <button type="button" className="vr-button vr-button-light" onClick={onStart} data-testid="button-final-start">
            {t.start}<DirectionArrow size={17} strokeWidth={2.2} />
          </button>
        </div>
        <div className="vr-final-mark"><img src="/assets/vidreward-mark.png" alt="" /></div>
      </section>

      <footer className="vr-footer">
        <img src="/assets/vidreward-mark.png" alt="VidReward" />
        <p>{t.footer}</p>
        <button type="button" onClick={onStart} className="vr-footer-link" data-testid="button-footer-start">{t.start}<DirectionArrow size={14} /></button>
      </footer>
    </main>
  );
}

export default LandingIntro;