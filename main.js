const header = document.querySelector('.site-header');
const nav = document.querySelector('.site-nav');
const navList = document.querySelector('.nav__list');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelectorAll('.nav__link');
const sections = document.querySelectorAll('main section, footer#contact');
const ctaButtons = document.querySelectorAll('#cta-start, .pricing-card .button');
const referralForm = document.querySelector('[data-referral-form]');
const referralResult = document.querySelector('.referral__result');
const referralLinkOutput = document.querySelector('#referral-link');
const copyButton = document.querySelector('[data-copy-button]');
const yearSpan = document.querySelector('[data-year]');
const accordion = document.querySelector('[data-accordion]');
const accordionTriggers = accordion ? accordion.querySelectorAll('.accordion__trigger') : [];

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefersReducedMotion = reduceMotionQuery.matches;

reduceMotionQuery.addEventListener?.('change', (event) => {
  prefersReducedMotion = event.matches;
});

const headerOffset = header ? header.offsetHeight + 8 : 0;

document.documentElement.style.setProperty('--header-offset', `${headerOffset}px`);

yearSpan && (yearSpan.textContent = new Date().getFullYear());

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

if (navList) {
  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || !targetId.startsWith('#')) return;
      event.preventDefault();
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        const sectionTop = targetSection.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: sectionTop, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
      nav.classList.remove('open');
      navToggle && navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute('id');
        if (!id) return;
        const link = document.querySelector(`.nav__link[href="#${id}"]`);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach((navLink) => navLink.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    },
    {
      rootMargin: `-${headerOffset}px 0px -70% 0px`,
      threshold: 0.35,
    }
  );

  sections.forEach((section) => observer.observe(section));
}

ctaButtons.forEach((button) => {
  button.addEventListener('click', () => {
    console.log('CTA click', { id: button.id || button.textContent?.trim() });
    // TODO: Hook into analytics platform (GA4, etc.)
  });
});

if (referralForm && referralResult && referralLinkOutput && copyButton) {
  referralForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(referralForm);
    const email = formData.get('email');

    if (!email) return;

    const code = `ygp_ref_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const url = `https://yourgoalplanner.com/?ref=${code}`;

    referralLinkOutput.value = url;
    referralLinkOutput.textContent = url;
    referralResult.hidden = false;

    console.log('Referral generated', { email, code });
  });

  copyButton.addEventListener('click', async () => {
    const text = referralLinkOutput.value || referralLinkOutput.textContent;
    if (!text) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 2000);
    } catch (error) {
      console.error('Copy failed', error);
    }
  });
}

if (accordion && accordionTriggers.length) {
  accordionTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;

      accordionTriggers.forEach((otherTrigger) => {
        const otherPanelId = otherTrigger.getAttribute('aria-controls');
        const otherPanel = otherPanelId ? document.getElementById(otherPanelId) : null;
        otherTrigger.setAttribute('aria-expanded', 'false');
        if (otherPanel) {
          otherPanel.hidden = true;
        }
      });

      if (!isExpanded) {
        trigger.setAttribute('aria-expanded', 'true');
        panel && (panel.hidden = false);
        panel && panel.setAttribute('tabindex', '-1');
        panel && panel.focus({ preventScroll: true });
      }
    });
  });
}
