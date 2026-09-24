import { BriefingCard } from '@/components/briefing-card';
import { EvidenceDemo } from '@/components/evidence-demo';
import { HudConsole } from '@/components/hud-console';
import {
  ArrowIcon,
  BanIcon,
  CodeIcon,
  CompassIcon,
  GitHubIcon,
  HandIcon,
  ServerIcon,
  ShieldIcon,
} from '@/components/icons';
import { Code } from '@/components/code';
import { Logo, Mark } from '@/components/logo';
import { LINKS } from '@/lib/site';

const QUICK_START = `$ git clone ${LINKS.repo} arclight && cd arclight
$ cp .env.example .env           # add your API keys and a password
$ docker compose up -d --build   # then open http://localhost:3000`;

const SDK_SNIPPET = `const arclight = createArclightClient({
  baseUrl, apiKey,
});
const { data } =
  await arclight.GET('/businesses');`;

const AGENT_SNIPPET = `you › Find 20 dental clinics in
      Surabaya that need a new website.
arclight.search_prospects(…)
arclight.audit(…)        # × 20`;

const STEPS = [
  {
    title: 'Find',
    text: 'Search Google Maps for “dental clinics in Surabaya”, paste a list of websites, or import a CSV.',
    tag: 'Google Places API',
  },
  {
    title: 'Audit',
    text: 'Arclight visits every website and measures speed on phones, HTTPS, outdated tech, contact forms and social links.',
    tag: 'PageSpeed Insights',
  },
  {
    title: 'Score',
    text: 'Two scores: how much they need you, and whether they can afford you. The best leads rise to the top.',
    tag: 'Need × capacity',
  },
  {
    title: 'Draft',
    text: 'A WhatsApp message and an email that cite only what was measured, in your agency’s voice.',
    tag: 'Claude',
  },
  {
    title: 'You send',
    text: 'One click opens WhatsApp or email with the message filled in. Track every reply in a simple pipeline.',
    tag: 'Human in the loop',
  },
];

const PRINCIPLES = [
  {
    icon: <HandIcon />,
    title: 'Human in the loop',
    text: 'Arclight drafts. You send. Nothing leaves your agency without a person pressing the button.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Official data only',
    text: 'Google Places for search, keeping only place IDs as Google’s terms require. No scraping of Maps or social networks.',
  },
  {
    icon: <BanIcon />,
    title: 'Do-not-contact list',
    text: 'Asked to stop? One click and a business is never tracked, shown or drafted again.',
  },
  {
    icon: <ServerIcon />,
    title: 'Self-hosted and private',
    text: 'Runs on your own server with Docker. Your leads and your clients’ data stay with you.',
  },
  {
    icon: <CodeIcon />,
    title: 'Open source',
    text: 'AGPL-3.0 engine and an MIT-licensed SDK. Read every line, run it anywhere, make it better.',
  },
  {
    icon: <CompassIcon />,
    title: 'Respectful by design',
    text: 'Honours robots.txt, blocks internal network addresses, and was designed with Indonesia’s PDP law and the GDPR in mind.',
  },
];

const ROADMAP = [
  {
    phase: 'Now',
    version: 'v0.1 · Early access',
    items: [
      'Google Maps search, website lists and CSV import',
      'Evidence-based website audits',
      'Need, capacity and priority scores',
      'WhatsApp and email drafts with Claude',
      'Pipeline, do-not-contact list and score tuning',
    ],
  },
  {
    phase: 'Next',
    version: 'v0.2 · Autopilot',
    items: [
      'Autonomous hunts on a schedule',
      'A daily briefing of new leads and replies',
      'MCP server for Claude, Hermes Agent and other agents',
      'Drop-in React components for your own admin',
      'Instagram signals',
    ],
  },
  {
    phase: 'Later',
    version: 'v0.3+',
    items: [
      'Plugins for marketing, SEO and creative agencies',
      'Team accounts and roles',
      'Agency memory: services, portfolio, pricing',
      'Proposal and report drafting',
    ],
  },
];

function SectionHead({
  index,
  eyebrow,
  title,
  lead,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="section-head">
      <p className="eyebrow">
        <span className="eyebrow-index">{index}</span>
        {eyebrow}
      </p>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Main">
        <div className="wrap nav-inner">
          <a href="#top" className="nav-logo" aria-label="Arclight home">
            <Logo id="nav-logo" />
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#principles">Principles</a>
            <a href="#developers">Developers</a>
            <a href="#roadmap">Roadmap</a>
          </div>
          <div className="nav-actions">
            <a className="icon-link" href={LINKS.repo} aria-label="Arclight on GitHub">
              <GitHubIcon />
            </a>
            <a className="btn btn-primary btn-sm" href={LINKS.gettingStarted}>
              Get started
            </a>
          </div>
        </div>
      </nav>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="pill">
                <span className="pill-dot" aria-hidden="true" />
                Early access · Open source
              </p>
              <h1>
                Your agency&apos;s <span className="arc-text">always&#8209;on</span> lead hunter.
              </h1>
              <p className="hero-lead">
                Arclight finds businesses that need what you sell, proves it with evidence from
                their own website, and drafts the first message. You review it and press send. It
                never spams on your behalf.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary" href={LINKS.gettingStarted}>
                  Get started <ArrowIcon />
                </a>
                <a className="btn btn-ghost" href={LINKS.repo}>
                  <GitHubIcon /> View on GitHub
                </a>
              </div>
              <ul className="hero-meta" aria-label="Highlights">
                <li>Self-hosted</li>
                <li>Official Google APIs</li>
                <li>Drafts by Claude</li>
              </ul>
            </div>
            <div className="hero-visual">
              <HudConsole />
              <p className="caption">Illustrative example</p>
            </div>
          </div>
        </section>

        <section className="band" aria-label="Who Arclight is for">
          <div className="wrap band-inner">
            <p>
              <strong>Built for agencies.</strong> Tuned first for web agencies, with marketing, SEO
              and creative agencies next.
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby="problem-title">
          <div className="wrap">
            <header className="section-head">
              <p className="eyebrow">
                <span className="eyebrow-index">01</span>The problem
              </p>
              <h2 id="problem-title">Finding clients is the job nobody has time for.</h2>
            </header>
            <div className="problems">
              <article className="card">
                <h3>Research eats the week</h3>
                <p>
                  Hours on Google Maps and spreadsheets, and you still don’t know who is worth
                  calling.
                </p>
              </article>
              <article className="card">
                <h3>Generic pitches get ignored</h3>
                <p>
                  “We build websites, are you interested?” gives a busy owner no reason to reply.
                </p>
              </article>
              <article className="card">
                <h3>Blasting gets you blocked</h3>
                <p>
                  Bulk WhatsApp and cold-email automation burn your number and your domain’s
                  reputation.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <SectionHead
              index="02"
              eyebrow="How it works"
              title="From a search to a sent message in minutes."
              lead="Arclight does the research and the writing. You make the call."
            />
            <ol className="steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="step">
                  <span className="step-index">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <span className="step-tag">{step.tag}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" aria-labelledby="evidence-title">
          <div className="wrap split">
            <div>
              <header className="section-head">
                <p className="eyebrow">
                  <span className="eyebrow-index">03</span>Evidence, not guesswork
                </p>
                <h2 id="evidence-title">Every claim in a message is measured.</h2>
              </header>
              <div className="prose">
                <p>
                  Arclight doesn’t pitch with industry statistics. Each draft cites what it found on
                  the prospect’s own website, so the message is specific, true and hard to ignore.
                </p>
                <p>
                  Leads are ranked by the geometric mean of <em>need</em> and <em>capacity</em>: an
                  established business with visible gaps beats a tiny one with a broken site, and a
                  thriving one with a perfect site.
                </p>
                <p>
                  If a draft mentions a number that the audit never measured, Arclight flags it
                  before you send.
                </p>
              </div>
            </div>
            <div>
              <EvidenceDemo />
              <p className="caption">Illustrative example</p>
            </div>
          </div>
        </section>

        <section className="section" id="principles">
          <div className="wrap">
            <SectionHead
              index="04"
              eyebrow="Principles"
              title="Built to be trusted with your reputation."
              lead="Outreach done wrong gets agencies blocked, reported or worse. Arclight is designed to make the right way the easy way."
            />
            <div className="principles">
              {PRINCIPLES.map((p) => (
                <article key={p.title} className="principle">
                  <span className="principle-icon">{p.icon}</span>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="developers">
          <div className="wrap">
            <SectionHead
              index="05"
              eyebrow="Developers"
              title="Use it your way."
              lead="Arclight is an engine with a documented API. Its own dashboard uses that API, just as your website or an AI agent would."
            />
            <div className="ways">
              <article className="way">
                <p className="way-kicker">Dashboard</p>
                <h3>Everything in the browser</h3>
                <p>Find, review, draft and track leads without writing a line of code.</p>
                <ul className="way-list">
                  <li>Google Maps search and CSV import</li>
                  <li>Evidence and scores for every lead</li>
                  <li>One-click WhatsApp and email</li>
                </ul>
                <a className="text-link" href={LINKS.userGuide}>
                  User guide <ArrowIcon />
                </a>
              </article>
              <article className="way">
                <p className="way-kicker">Your website</p>
                <h3>API and typed SDK</h3>
                <p>Put Arclight inside your own admin panel, whatever it is built with.</p>
                <Code label="Using the TypeScript SDK" code={SDK_SNIPPET} />
                <a className="text-link" href={LINKS.embedding}>
                  Embedding guide <ArrowIcon />
                </a>
              </article>
              <article className="way">
                <p className="way-kicker">
                  AI agents <span className="soon">Coming in v0.2</span>
                </p>
                <h3>A tool for any agent</h3>
                <p>
                  An MCP server lets Claude, Hermes Agent and others use Arclight as their lead
                  generation skill.
                </p>
                <Code label="Example request to an AI agent" code={AGENT_SNIPPET} />
              </article>
            </div>
            <div className="terminal">
              <p className="terminal-head">
                <span className="hud-label">Quick start</span>
                <span className="terminal-note">Docker · about 5 minutes</span>
              </p>
              <Code label="Run Arclight with Docker" code={QUICK_START} className="code-wide" />
              <a className="text-link" href={LINKS.gettingStarted}>
                Full setup guide, including API keys <ArrowIcon />
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="roadmap">
          <div className="wrap">
            <SectionHead
              index="06"
              eyebrow="Roadmap"
              title="From co-pilot to autopilot."
              lead="Today Arclight works when you ask. Next, it hunts on its own and briefs you every morning. You still decide who gets a message."
            />
            <div className="phases">
              {ROADMAP.map((phase) => (
                <article key={phase.phase} className={`phase phase-${phase.phase.toLowerCase()}`}>
                  <p className="phase-head">
                    <span className="phase-name">{phase.phase}</span>
                    <span className="hud-label">{phase.version}</span>
                  </p>
                  <ul>
                    {phase.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="autopilot">
              <div>
                <h3>Autopilot, with you in charge.</h3>
                <div className="prose">
                  <p>
                    Tell Arclight who you are looking for once. It searches on a schedule, audits
                    and scores what it finds, and has drafts waiting when you start your day.
                  </p>
                  <p>
                    It still never sends a message on its own. The difference is that the research
                    is already done when you sit down.
                  </p>
                </div>
              </div>
              <BriefingCard />
            </div>
          </div>
        </section>

        <section className="final" aria-labelledby="final-title">
          <div className="final-glow" aria-hidden="true" />
          <div className="wrap final-inner">
            <Mark id="final-mark" className="final-mark" />
            <h2 id="final-title">Light up your pipeline.</h2>
            <p>
              Arclight is in early access. Today it is used by one agency, Vera &amp; Co., and
              shaped by what they learn. Try it, break it, and tell us what you find.
            </p>
            <div className="cta-row center">
              <a className="btn btn-primary" href={LINKS.gettingStarted}>
                Get started <ArrowIcon />
              </a>
              <a className="btn btn-ghost" href={LINKS.repo}>
                <GitHubIcon /> Star on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <Logo id="footer-logo" />
            <p>Open-source lead generation for agencies.</p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href={LINKS.docs}>Documentation</a>
            <a href={LINKS.gettingStarted}>Getting started</a>
            <a href={LINKS.api}>API</a>
            <a href={LINKS.roadmap}>Roadmap</a>
            <a href={LINKS.security}>Security</a>
            <a href={LINKS.repo}>GitHub</a>
          </nav>
          <p className="footer-legal">
            © 2026 The Arclight authors · <a href={LINKS.license}>AGPL-3.0</a> · Made in Indonesia.
            Arclight is not affiliated with Marvel.
          </p>
        </div>
      </footer>
    </>
  );
}
