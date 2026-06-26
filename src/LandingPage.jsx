import { useRef, useState, useEffect } from "react";
import qrImg from "../assest/qr.jpeg";

// ─── 3D Tilt Card ────────────────────────────────────────────────────────────
function TiltCard({ children, style, glowColor = "rgba(255,107,53,0.3)" }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    const r  = el.getBoundingClientRect();
    const x  = (e.clientX - r.left) / r.width;
    const y  = (e.clientY - r.top)  / r.height;
    const rx = (y - 0.5) * -14;
    const ry = (x - 0.5) *  14;
    el.style.transform  = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(16px)`;
    el.style.boxShadow  = `0 30px 60px rgba(0,0,0,0.5), 0 0 40px ${glowColor}`;
  };
  const onLeave = () => {
    const el = ref.current;
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)";
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        background:           "rgba(255,255,255,0.04)",
        backdropFilter:       "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border:               "1px solid rgba(255,255,255,0.09)",
        borderRadius:         22,
        boxShadow:            "0 8px 32px rgba(0,0,0,0.25)",
        transition:           "transform 0.15s ease, box-shadow 0.3s ease",
        willChange:           "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── QR Popup Modal ──────────────────────────────────────────────────────────
function QRModal({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={(e) => e.stopPropagation()}>
        <button style={M.closeBtn} onClick={onClose}>✕</button>
        <div style={M.modalHeader}>
          <div style={M.heartIcon}>☕</div>
          <h2 style={M.modalTitle}>Support the Developer</h2>
          <p style={M.modalSub}>
            This tool is free forever. If it saved your time,<br/>
            consider buying me a coffee! 🙏
          </p>
        </div>

        {/* QR Code */}
        <div style={M.qrWrap}>
          <img
            src={qrImg}
            alt="Scan to support the developer via UPI or any payment app"
            style={M.qrImg}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          {/* Fallback if QR not uploaded yet */}
          <div style={{ ...M.qrFallback, display: "none" }}>
            <div style={M.qrPlaceholderBox}>
              <div style={M.qrPlaceholderText}>📲</div>
              <div style={M.qrPlaceholderSub}>QR Code coming soon</div>
              <div style={M.qrPlaceholderHint}>Place your QR image at:<br/><code>public/assets/qr.png</code></div>
            </div>
          </div>
        </div>

        <div style={M.supportMsg}>
          <div style={M.supportTag}>Scan QR with any UPI app</div>
          <div style={M.supportApps}>PhonePe · GPay · Paytm · BHIM</div>
        </div>

        <div style={M.thankYou}>
          Made with ❤️ in India · All processing is 100% private &amp; browser-based
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...F.item, ...(open ? F.itemOpen : {}) }}>
      <button style={F.q} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <span style={{ ...F.arrow, ...(open ? F.arrowOpen : {}) }}>›</span>
      </button>
      {open && <div style={F.a}>{a}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LandingPage Component
// ════════════════════════════════════════════════════════════════════════════
export default function LandingPage({ onStart }) {
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    document.title = "Free Marathi OCR Online | ZIP Image to Text | मराठी OCR Tool 2026";
  }, []);

  const STEPS = [
    {
      num: "01", icon: "📦",
      title: "Upload Your ZIP File",
      desc: "Pack all your images (JPG, PNG, WebP, BMP) into a single ZIP file and drag-and-drop or browse to upload. Works with Marathi documents, scanned pages, or any image with text.",
      glow: "rgba(255,107,53,0.25)",
    },
    {
      num: "02", icon: "✨",
      title: "AI-Enhanced OCR Processing",
      desc: "Each image is automatically upscaled, converted to grayscale, contrast-boosted, and sharpened before Tesseract.js extracts the text — all happening inside your browser, privately.",
      glow: "rgba(139,92,246,0.25)",
    },
    {
      num: "03", icon: "📄",
      title: "Download Your Text File",
      desc: "Download all extracted text as a single combined TXT file or separate files per image. UTF-8 encoded, preserving Devanagari, Hindi and English characters perfectly.",
      glow: "rgba(6,182,212,0.25)",
    },
  ];

  const FEATURES = [
    { icon: "🔒", title: "100% Private", desc: "Your images never leave your device. No servers, no uploads, no logging. Complete privacy guaranteed.", glow: "rgba(6,182,212,0.2)" },
    { icon: "📦", title: "ZIP to TXT Batch OCR", desc: "Upload a ZIP of hundreds of images and get all text extracted sequentially with live progress tracking.", glow: "rgba(255,107,53,0.2)" },
    { icon: "🆓", title: "Free Forever", desc: "No API key, no credit card, no subscription. Fully open-source using Tesseract.js — free forever.", glow: "rgba(76,175,125,0.2)" },
    { icon: "🌐", title: "मराठी, हिंदी & English", desc: "Supports Devanagari script for Marathi & Hindi, English, and mixed-language documents simultaneously.", glow: "rgba(255,209,102,0.2)" },
    { icon: "⚡", title: "Enhanced Preprocessing", desc: "Auto-upscaling, grayscale conversion, contrast boost and unsharp masking applied before OCR for maximum accuracy.", glow: "rgba(139,92,246,0.2)" },
    { icon: "🖥️", title: "No Installation", desc: "Works entirely in your browser — Chrome, Firefox, Edge. No app to install, no software to download.", glow: "rgba(255,107,53,0.2)" },
  ];

  const FAQS = [
    { q: "Is this Marathi OCR tool completely free?", a: "Yes, 100% free forever. No signup, no API key, no subscription, no hidden charges. It uses open-source Tesseract.js which runs entirely in your browser." },
    { q: "Is my data stored anywhere?", a: "Absolutely not. All OCR processing happens locally inside your browser. Your images and extracted text never leave your device. We have zero access to your data." },
    { q: "How does the ZIP file OCR feature work?", a: "Create a ZIP file with your images (JPG, PNG, WebP, BMP), upload it to the tool, select your language combination (Marathi, Hindi, English or mix), and click process. Each image is enhanced then OCR'd, and you can download the results as TXT files." },
    { q: "What languages does the OCR support?", a: "The tool supports Marathi (मराठी), Hindi (हिंदी), English, and any combination of these three languages simultaneously. It uses Tesseract.js with Devanagari script models for high accuracy." },
    { q: "How accurate is the Marathi OCR?", a: "Accuracy depends on image quality. The built-in preprocessing pipeline (upscaling, contrast boost, unsharp masking) significantly improves results. For best accuracy, use clear, high-resolution, printed images with good contrast." },
    { q: "Does it work on mobile or offline?", a: "Yes, it works on any modern mobile browser. An initial internet connection is needed to load the OCR engine, but once loaded, all processing is local. It does not require internet for image processing." },
  ];

  return (
    <div style={L.page}>
      {/* ── Background Orbs ── */}
      <div style={L.orb1} aria-hidden="true" />
      <div style={L.orb2} aria-hidden="true" />
      <div style={L.orb3} aria-hidden="true" />

      {/* ══════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════ */}
      <header style={L.navbar}>
        <div style={L.navInner}>
          <div style={L.navLogo}>
            <span style={L.navLogoGlyph}>अ</span>
            <div>
              <span style={L.navLogoText}>Marathi OCR</span>
              <span style={L.navLogoTag}>मराठी</span>
            </div>
          </div>
          <nav style={L.navLinks} aria-label="Main navigation">
            <a href="#how-it-works" style={L.navLink}>How It Works</a>
            <a href="#features"     style={L.navLink}>Features</a>
            <a href="#privacy"      style={L.navLink}>Privacy</a>
            <a href="#faq"          style={L.navLink}>FAQ</a>
          </nav>
          <button style={L.navCta} onClick={onStart}>
            Launch Tool →
          </button>
        </div>
      </header>

      <main>
        {/* ══════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════ */}
        <section id="hero" style={L.hero} aria-labelledby="hero-heading">
          <div style={L.heroInner}>
            {/* Live badge */}
            <div style={L.heroBadge} className="anim-fade-up">
              <span style={L.heroBadgeDot} />
              Free · Open Source · No Signup · No API Key
            </div>

            {/* H1 */}
            <h1 id="hero-heading" style={L.heroTitle} className="anim-fade-up anim-delay-1">
              <span className="grad-text">Free Marathi OCR</span>
              <br />
              <span style={L.heroTitleSub}>Convert ZIP Images to Text Instantly</span>
            </h1>

            {/* Subtitle — keyword rich */}
            <p style={L.heroDesc} className="anim-fade-up anim-delay-2">
              The most accurate <strong style={{ color: "#FF9F1C" }}>free online Marathi OCR tool</strong>.
              Upload a <strong style={{ color: "#FF9F1C" }}>ZIP file of images</strong> and extract
              Devanagari, Hindi &amp; English text in seconds — 100% browser-based, no data stored,
              no signup required.
            </p>

            {/* Feature pills */}
            <div style={L.pillsRow} className="anim-fade-up anim-delay-3">
              {["🔒 100% Private", "⚡ No API Key", "🆓 Forever Free", "📦 ZIP → TXT", "🌐 मराठी हिंदी English"].map((p) => (
                <span key={p} style={L.featurePill}>{p}</span>
              ))}
            </div>

            {/* CTA */}
            <div style={L.ctaRow} className="anim-fade-up anim-delay-4">
              <button style={L.ctaBtn} onClick={onStart} id="hero-cta-btn">
                Start OCR Now — It&apos;s Free →
              </button>
              <div style={L.ctaNote}>No signup · No credit card · Works instantly</div>
            </div>

            {/* Stats bar */}
            <div style={L.statsBar} className="anim-fade-up anim-delay-5">
              {[["6", "Language options"], ["100%", "Browser-based"], ["0", "Data stored"], ["∞", "Images supported"]].map(([n, l], i) => (
                <div key={i} style={L.statItem}>
                  <div style={L.statNum}>{n}</div>
                  <div style={L.statLabel}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════════════ */}
        <section id="how-it-works" style={L.section} aria-labelledby="how-heading">
          <div style={L.sectionInner}>
            <div style={L.sectionBadge}>Simple Process</div>
            <h2 id="how-heading" style={L.sectionTitle}>
              How to Convert ZIP Images to Marathi Text
            </h2>
            <p style={L.sectionSub}>
              Three simple steps to extract text from your Marathi, Hindi or English images using our free OCR tool
            </p>

            <div style={L.stepsGrid}>
              {STEPS.map((step) => (
                <TiltCard key={step.num} style={L.stepCard} glowColor={step.glow}>
                  <div style={L.stepNum}>{step.num}</div>
                  <div style={L.stepIcon}>{step.icon}</div>
                  <h3 style={L.stepTitle}>{step.title}</h3>
                  <p style={L.stepDesc}>{step.desc}</p>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            FEATURES
        ══════════════════════════════════════════════ */}
        <section id="features" style={L.section} aria-labelledby="features-heading">
          <div style={L.sectionInner}>
            <div style={L.sectionBadge}>Why Choose Us</div>
            <h2 id="features-heading" style={L.sectionTitle}>
              Everything You Need in a Free OCR Tool
            </h2>
            <p style={L.sectionSub}>
              Powerful Marathi OCR features with complete privacy — all running inside your browser
            </p>

            <div style={L.featuresGrid}>
              {FEATURES.map((f) => (
                <TiltCard key={f.title} style={L.featureCard} glowColor={f.glow}>
                  <div style={L.featureIcon}>{f.icon}</div>
                  <h3 style={L.featureTitle}>{f.title}</h3>
                  <p style={L.featureDesc}>{f.desc}</p>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            PRIVACY SECTION
        ══════════════════════════════════════════════ */}
        <section id="privacy" style={L.privacySection} aria-labelledby="privacy-heading">
          <div style={L.sectionInner}>
            <div style={L.privacyCard}>
              <div style={L.privacyLeft}>
                <div style={L.privacyIcon}>🛡️</div>
                <h2 id="privacy-heading" style={L.privacyTitle}>
                  Your Data Never Leaves Your Browser
                </h2>
                <p style={L.privacyDesc}>
                  Unlike other OCR tools that upload your images to external servers,{" "}
                  <strong style={{ color: "#4CAF7D" }}>our Marathi OCR processes everything locally</strong>{" "}
                  inside your browser using Tesseract.js — an open-source OCR engine. No servers,
                  no cloud storage, no tracking. Your documents remain 100% private.
                </p>
                <div style={L.privacyPoints}>
                  {[
                    "✓ No image uploads to external servers",
                    "✓ No account or login required",
                    "✓ No cookies or tracking",
                    "✓ No data logs or analytics on your content",
                    "✓ Works with sensitive Marathi documents safely",
                  ].map((pt) => (
                    <div key={pt} style={L.privacyPoint}>{pt}</div>
                  ))}
                </div>
              </div>
              <div style={L.privacyRight}>
                <div style={L.privacyVisual}>
                  <div style={L.pvIcon}>🖥️</div>
                  <div style={L.pvLabel}>Your Browser</div>
                  <div style={L.pvArrow}>↕ All processing here</div>
                  <div style={L.pvBox}>
                    <div style={L.pvItem}>📦 ZIP Upload</div>
                    <div style={L.pvItem}>✨ Image Enhance</div>
                    <div style={L.pvItem}>🔍 OCR Engine</div>
                    <div style={L.pvItem}>📄 Text Output</div>
                  </div>
                  <div style={L.pvNever}>🚫 Never sent to any server</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            LANGUAGES
        ══════════════════════════════════════════════ */}
        <section id="languages" style={L.section} aria-labelledby="lang-heading">
          <div style={L.sectionInner}>
            <div style={L.sectionBadge}>Multi-Language OCR</div>
            <h2 id="lang-heading" style={L.sectionTitle}>Supported Scripts &amp; Languages</h2>
            <p style={L.sectionSub}>
              Extract text from Devanagari script (Marathi &amp; Hindi) and English, or any combination
            </p>

            <div style={L.langGrid}>
              {[
                { script: "मराठी", name: "Marathi", tag: "Devanagari Script", color: "#FF6B35" },
                { script: "हिंदी", name: "Hindi",   tag: "Devanagari Script", color: "#8B5CF6" },
                { script: "Abc",   name: "English", tag: "Latin Script",       color: "#06B6D4" },
                { script: "मि Abc",name: "Mixed",   tag: "Multiple scripts",   color: "#4CAF7D" },
              ].map((l) => (
                <TiltCard key={l.name} style={L.langCard} glowColor={`${l.color}33`}>
                  <div style={{ ...L.langScript, color: l.color }}>{l.script}</div>
                  <div style={L.langName}>{l.name}</div>
                  <div style={L.langTag}>{l.tag}</div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            SUPPORT DEVELOPER
        ══════════════════════════════════════════════ */}
        <section id="support" style={L.supportSection} aria-labelledby="support-heading">
          <div style={L.sectionInner}>
            <TiltCard style={L.supportCard} glowColor="rgba(255,209,102,0.2)">
              <div style={L.supportInner}>
                <div style={L.supportLeft}>
                  <div style={L.supportEmoji}>☕</div>
                  <h2 id="support-heading" style={L.supportTitle}>Support the Developer</h2>
                  <p style={L.supportDesc}>
                    This free Marathi OCR tool is built and maintained solo. If it saved you hours of
                    manual typing, consider buying me a coffee! Your support helps keep this tool
                    free, updated and improving for everyone. 🙏
                  </p>
                  <button style={L.supportBtn} onClick={() => setShowQR(true)} id="show-qr-btn">
                    ☕ Show QR Code to Support
                  </button>
                  <p style={L.supportHint}>Scan with PhonePe · GPay · Paytm · BHIM</p>
                </div>
                <div style={L.supportRight}>
                  <div style={L.supportFeatures}>
                    {["✓ Free forever", "✓ Regular updates", "✓ Better accuracy", "✓ New features"].map((f) => (
                      <div key={f} style={L.supportFeature}>{f}</div>
                    ))}
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            FAQ
        ══════════════════════════════════════════════ */}
        <section id="faq" style={L.section} aria-labelledby="faq-heading">
          <div style={L.sectionInner}>
            <div style={L.sectionBadge}>Frequently Asked Questions</div>
            <h2 id="faq-heading" style={L.sectionTitle}>Common Questions About Marathi OCR</h2>
            <p style={L.sectionSub}>Everything you need to know about our free online OCR tool</p>

            <div style={L.faqList}>
              {FAQS.map((faq) => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            CTA BOTTOM
        ══════════════════════════════════════════════ */}
        <section style={L.ctaSection} aria-label="Call to action">
          <div style={L.ctaInner}>
            <div style={L.ctaOrb1} aria-hidden="true" />
            <div style={L.ctaOrb2} aria-hidden="true" />
            <h2 style={L.ctaTitle}>Ready to Extract Marathi Text?</h2>
            <p style={L.ctaSubtitle}>
              Join thousands using our free ZIP image OCR tool — no signup, no limits, no cost
            </p>
            <button style={L.ctaBtnLg} onClick={onStart} id="bottom-cta-btn">
              🚀 Launch Free OCR Tool
            </button>
            <p style={L.ctaDisclaimer}>
              100% private · All processing in your browser · Supports मराठी, हिंदी, English
            </p>
          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer style={L.footer} role="contentinfo">
        <div style={L.footerInner}>
          <div style={L.footerLogo}>
            <span style={L.footerGlyph}>अ</span>
            <div>
              <div style={L.footerBrand}>Marathi OCR</div>
              <div style={L.footerTagline}>Free · Private · Browser-based</div>
            </div>
          </div>
          <div style={L.footerLinks}>
            <a href="#how-it-works" style={L.footerLink}>How It Works</a>
            <a href="#features"     style={L.footerLink}>Features</a>
            <a href="#privacy"      style={L.footerLink}>Privacy</a>
            <a href="#faq"          style={L.footerLink}>FAQ</a>
          </div>
          <div style={L.footerMeta}>
            <div style={L.footerCopy}>© 2026 Marathi OCR · Built with Tesseract.js</div>
            <div style={L.footerKw}>
              Free Marathi OCR · Devanagari OCR · ZIP to Text · हिंदी OCR · Image to Text
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Floating Support Button ─── */}
      <button
        style={L.floatBtn}
        onClick={() => setShowQR(true)}
        title="Support the developer"
        aria-label="Support the developer"
        id="float-support-btn"
      >
        ☕
      </button>

      {/* ─── QR Modal ─── */}
      {showQR && <QRModal onClose={() => setShowQR(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════════════════════
const glass = {
  background:           "rgba(255,255,255,0.04)",
  backdropFilter:       "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border:               "1px solid rgba(255,255,255,0.09)",
  borderRadius:         22,
};

const L = {
  page: { minHeight: "100vh", background: "#050510", color: "#E8E4DC", fontFamily: "'Inter',system-ui,sans-serif", position: "relative", overflowX: "hidden" },

  // Orbs
  orb1: { position: "fixed", top: "5%",  left: "5%",  width: 600, height: 600, background: "radial-gradient(circle, rgba(255,107,53,0.14) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", animation: "floatOrb 18s ease-in-out infinite", zIndex: 0 },
  orb2: { position: "fixed", top: "30%", right: "5%", width: 500, height: 500, background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",  borderRadius: "50%", pointerEvents: "none", animation: "floatOrb2 22s ease-in-out infinite", zIndex: 0 },
  orb3: { position: "fixed", bottom: "10%", left: "30%", width: 400, height: 400, background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", animation: "floatOrb3 16s ease-in-out infinite", zIndex: 0 },

  // Navbar
  navbar: { position: "sticky", top: 0, zIndex: 200, background: "rgba(5,5,16,0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 24 },
  navLogo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  navLogoGlyph: { fontSize: 28, background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 },
  navLogoText: { fontSize: 18, fontWeight: 800, color: "#F0EBE0", letterSpacing: "-0.3px" },
  navLogoTag: { fontSize: 11, color: "#FF6B35", marginLeft: 6, background: "rgba(255,107,53,0.12)", padding: "2px 6px", borderRadius: 4, fontFamily: "'Noto Sans Devanagari',sans-serif" },
  navLinks: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 28 },
  navLink: { color: "#8B8DA0", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color .15s" },
  navCta: { background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", animation: "pulseGlow 3s ease-in-out infinite" },

  // Hero
  hero: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: "80px 28px" },
  heroInner: { maxWidth: 820, margin: "0 auto", textAlign: "center" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.25)", color: "#FF9F1C", padding: "6px 16px", borderRadius: 99, fontSize: 13, fontWeight: 500, marginBottom: 28 },
  heroBadgeDot: { width: 6, height: 6, background: "#4CAF7D", borderRadius: "50%", display: "inline-block", animation: "badgePulse 2s ease-in-out infinite" },
  heroTitle: { fontSize: 72, fontWeight: 900, lineHeight: 1.08, marginBottom: 20, letterSpacing: "-2px" },
  heroTitleSub: { fontSize: 48, fontWeight: 700, color: "#C8C0D0", display: "block", letterSpacing: "-1px" },
  heroDesc: { fontSize: 19, lineHeight: 1.7, color: "#8B8DA0", maxWidth: 640, margin: "0 auto 28px", fontWeight: 400 },
  pillsRow: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 36 },
  featurePill: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#C8C0D0", padding: "7px 16px", borderRadius: 99, fontSize: 13, fontWeight: 500, backdropFilter: "blur(8px)" },
  ctaRow: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 48 },
  ctaBtn: { background: "linear-gradient(135deg,#FF6B35 0%,#FF9F1C 100%)", color: "#fff", border: "none", padding: "18px 40px", borderRadius: 14, fontWeight: 800, fontSize: 18, cursor: "pointer", letterSpacing: "0.2px", animation: "pulseGlow 3s ease-in-out infinite", transition: "transform .15s" },
  ctaNote: { fontSize: 13, color: "#5A5870" },
  statsBar: { display: "flex", gap: 0, justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 32 },
  statItem: { textAlign: "center", padding: "0 32px", borderRight: "1px solid rgba(255,255,255,0.06)" },
  statNum: { fontSize: 32, fontWeight: 900, background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  statLabel: { fontSize: 12, color: "#5A5870", marginTop: 4 },

  // Sections
  section: { padding: "90px 28px", position: "relative", zIndex: 1 },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionBadge: { display: "inline-block", background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)", color: "#FF9F1C", padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, marginBottom: 16, letterSpacing: "0.5px", textTransform: "uppercase" },
  sectionTitle: { fontSize: 40, fontWeight: 800, color: "#F0EBE0", marginBottom: 14, letterSpacing: "-0.8px", lineHeight: 1.2 },
  sectionSub: { fontSize: 17, color: "#6B6D80", maxWidth: 600, lineHeight: 1.65, marginBottom: 52 },

  // Steps
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 },
  stepCard: { padding: "32px 28px", position: "relative", overflow: "hidden" },
  stepNum: { fontSize: 48, fontWeight: 900, color: "rgba(255,255,255,0.05)", position: "absolute", top: 16, right: 20, lineHeight: 1 },
  stepIcon: { fontSize: 40, marginBottom: 16 },
  stepTitle: { fontSize: 18, fontWeight: 700, color: "#F0EBE0", marginBottom: 10 },
  stepDesc: { fontSize: 14, color: "#6B6D80", lineHeight: 1.7 },

  // Features
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 },
  featureCard: { padding: "28px 24px" },
  featureIcon: { fontSize: 34, marginBottom: 14 },
  featureTitle: { fontSize: 16, fontWeight: 700, color: "#F0EBE0", marginBottom: 8 },
  featureDesc: { fontSize: 14, color: "#6B6D80", lineHeight: 1.65 },

  // Privacy
  privacySection: { padding: "90px 28px", background: "rgba(6,182,212,0.03)", borderTop: "1px solid rgba(6,182,212,0.08)", borderBottom: "1px solid rgba(6,182,212,0.08)", position: "relative", zIndex: 1 },
  privacyCard: { ...glass, padding: "48px 40px", display: "flex", gap: 48, alignItems: "flex-start", borderColor: "rgba(6,182,212,0.15)" },
  privacyLeft: { flex: 1 },
  privacyIcon: { fontSize: 48, marginBottom: 20 },
  privacyTitle: { fontSize: 32, fontWeight: 800, color: "#F0EBE0", marginBottom: 16, lineHeight: 1.25, letterSpacing: "-0.5px" },
  privacyDesc: { fontSize: 16, color: "#8B8DA0", lineHeight: 1.75, marginBottom: 24 },
  privacyPoints: { display: "flex", flexDirection: "column", gap: 10 },
  privacyPoint: { fontSize: 14, color: "#4CAF7D", fontWeight: 500 },
  privacyRight: { flex: "0 0 240px" },
  privacyVisual: { ...glass, padding: "24px 20px", textAlign: "center", borderColor: "rgba(6,182,212,0.2)" },
  pvIcon: { fontSize: 36, marginBottom: 8 },
  pvLabel: { fontSize: 14, fontWeight: 700, color: "#F0EBE0", marginBottom: 12 },
  pvArrow: { fontSize: 12, color: "#4CAF7D", marginBottom: 16, fontWeight: 600 },
  pvBox: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  pvItem: { background: "rgba(76,175,125,0.1)", border: "1px solid rgba(76,175,125,0.2)", color: "#4CAF7D", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500 },
  pvNever: { fontSize: 12, color: "#FF6B6B", fontWeight: 600 },

  // Languages
  langGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 },
  langCard: { padding: "32px 20px", textAlign: "center" },
  langScript: { fontSize: 44, fontWeight: 800, marginBottom: 10, fontFamily: "'Noto Sans Devanagari','Inter',sans-serif" },
  langName: { fontSize: 16, fontWeight: 700, color: "#F0EBE0", marginBottom: 4 },
  langTag: { fontSize: 12, color: "#5A5870" },

  // Support
  supportSection: { padding: "90px 28px", position: "relative", zIndex: 1 },
  supportCard: { padding: "48px 40px", borderColor: "rgba(255,209,102,0.15)", background: "rgba(255,209,102,0.03)" },
  supportInner: { display: "flex", alignItems: "center", gap: 48 },
  supportLeft: { flex: 1 },
  supportEmoji: { fontSize: 52, marginBottom: 16 },
  supportTitle: { fontSize: 32, fontWeight: 800, color: "#F0EBE0", marginBottom: 16, letterSpacing: "-0.5px" },
  supportDesc: { fontSize: 16, color: "#8B8DA0", lineHeight: 1.75, marginBottom: 28 },
  supportBtn: { background: "linear-gradient(135deg,#FFD166,#FF9F1C)", color: "#1A0A00", border: "none", padding: "14px 28px", borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: "pointer", marginBottom: 10 },
  supportHint: { fontSize: 13, color: "#5A5870" },
  supportRight: { flex: "0 0 220px" },
  supportFeatures: { display: "flex", flexDirection: "column", gap: 14 },
  supportFeature: { ...glass, padding: "12px 16px", fontSize: 14, color: "#FFD166", fontWeight: 600, borderColor: "rgba(255,209,102,0.15)" },

  // FAQ
  faqList: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 800 },

  // CTA Bottom
  ctaSection: { padding: "100px 28px", position: "relative", zIndex: 1, overflow: "hidden" },
  ctaInner: { maxWidth: 700, margin: "0 auto", textAlign: "center", position: "relative" },
  ctaOrb1: { position: "absolute", top: "50%", left: "50%", transform: "translate(-80%, -50%)", width: 400, height: 400, background: "radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  ctaOrb2: { position: "absolute", top: "50%", left: "50%", transform: "translate(-20%, -50%)", width: 350, height: 350, background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  ctaTitle: { fontSize: 44, fontWeight: 900, color: "#F0EBE0", marginBottom: 16, letterSpacing: "-1px", position: "relative" },
  ctaSubtitle: { fontSize: 18, color: "#6B6D80", marginBottom: 36, lineHeight: 1.6, position: "relative" },
  ctaBtnLg: { background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", color: "#fff", border: "none", padding: "20px 48px", borderRadius: 16, fontWeight: 800, fontSize: 20, cursor: "pointer", animation: "pulseGlow 3s ease-in-out infinite", display: "inline-block", marginBottom: 20, position: "relative" },
  ctaDisclaimer: { fontSize: 13, color: "#4A4A5A", position: "relative" },

  // Footer
  footer: { borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,16,0.9)", position: "relative", zIndex: 1 },
  footerInner: { maxWidth: 1100, margin: "0 auto", padding: "40px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" },
  footerLogo: { display: "flex", alignItems: "center", gap: 12 },
  footerGlyph: { fontSize: 28, background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 },
  footerBrand: { fontSize: 16, fontWeight: 700, color: "#F0EBE0" },
  footerTagline: { fontSize: 12, color: "#4A4A5A" },
  footerLinks: { display: "flex", gap: 24 },
  footerLink: { color: "#5A5870", textDecoration: "none", fontSize: 14, fontWeight: 500 },
  footerMeta: { textAlign: "right" },
  footerCopy: { fontSize: 13, color: "#4A4A5A", marginBottom: 4 },
  footerKw: { fontSize: 11, color: "#2E2E3E" },

  // Float button
  floatBtn: { position: "fixed", bottom: 28, right: 28, zIndex: 300, background: "linear-gradient(135deg,#FFD166,#FF9F1C)", color: "#1A0A00", border: "none", width: 52, height: 52, borderRadius: "50%", fontSize: 22, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,209,102,0.4)", animation: "pulseGlow 3s ease-in-out infinite" },
};

// ─── FAQ styles ───────────────────────────────────────────────────────────────
const F = {
  item: { ...glass, overflow: "hidden", transition: "all .2s", borderColor: "rgba(255,255,255,0.07)" },
  itemOpen: { borderColor: "rgba(255,107,53,0.25)", background: "rgba(255,107,53,0.04)" },
  q: { width: "100%", background: "transparent", border: "none", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "#F0EBE0", fontSize: 16, fontWeight: 600, textAlign: "left", gap: 12 },
  arrow: { fontSize: 22, color: "#5A5870", transition: "transform .2s", flexShrink: 0 },
  arrowOpen: { transform: "rotate(90deg)", color: "#FF9F1C" },
  a: { padding: "0 22px 18px", fontSize: 15, color: "#8B8DA0", lineHeight: 1.75 },
};

// ─── Modal styles ─────────────────────────────────────────────────────────────
const M = {
  overlay: { position: "fixed", inset: 0, background: "rgba(5,5,16,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease" },
  modal: { ...glass, maxWidth: 440, width: "100%", padding: "40px 36px", textAlign: "center", position: "relative", borderColor: "rgba(255,209,102,0.2)", animation: "modalIn 0.3s ease" },
  closeBtn: { position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#8B8DA0", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  modalHeader: { marginBottom: 28 },
  heartIcon: { fontSize: 48, marginBottom: 12 },
  modalTitle: { fontSize: 24, fontWeight: 800, color: "#F0EBE0", marginBottom: 8 },
  modalSub: { fontSize: 14, color: "#8B8DA0", lineHeight: 1.6 },
  qrWrap: { marginBottom: 20 },
  qrImg: { width: 200, height: 200, borderRadius: 16, border: "2px solid rgba(255,209,102,0.3)", objectFit: "contain", background: "#fff", padding: 4 },
  qrFallback: { display: "flex", justifyContent: "center" },
  qrPlaceholderBox: { width: 200, height: 200, borderRadius: 16, border: "2px dashed rgba(255,209,102,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,209,102,0.04)" },
  qrPlaceholderText: { fontSize: 40 },
  qrPlaceholderSub: { fontSize: 13, color: "#FFD166", fontWeight: 600 },
  qrPlaceholderHint: { fontSize: 11, color: "#5A5870", lineHeight: 1.5, textAlign: "center" },
  supportMsg: { marginBottom: 16 },
  supportTag: { fontSize: 14, color: "#FFD166", fontWeight: 700, marginBottom: 4 },
  supportApps: { fontSize: 13, color: "#5A5870" },
  thankYou: { fontSize: 13, color: "#4A4A5A", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 },
};
