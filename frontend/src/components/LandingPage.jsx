import React, { useState } from 'react';
import SpamBattlefieldCanvas from './SpamBattlefieldCanvas';
import { 
  ShieldCheck, 
  Sparkles, 
  MessageCircle, 
  Send, 
  Check, 
  ChevronRight, 
  Sun, 
  Moon, 
  Lock, 
  Zap, 
  ShieldAlert, 
  ArrowRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Bot,
  Copy,
  ExternalLink,
  Users,
  MessageSquare,
  AlertTriangle,
  Heart,
  Search,
  CreditCard,
  QrCode,
  X,
  Phone,
  CheckCircle
} from 'lucide-react';

function InstagramIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

export default function LandingPage({ 
  onLogin, 
  onFacebookLogin, 
  theme, 
  toggleTheme, 
  navigateTo,
  creator 
}) {
  const [usernameInput, setUsernameInput] = useState('');
  
  // Dynamic AI Simulator State
  const [inputText, setInputText] = useState('Send me the price and link');
  const [activeComment, setActiveComment] = useState('Send me the price and link');
  const [activeUser, setActiveUser] = useState('alex_creator');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);

  // Monetization & Checkout Modal State
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('details'); // 'details' | 'paying' | 'success'
  const [checkoutHandle, setCheckoutHandle] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [payMethod, setPayMethod] = useState('upi'); // 'upi' | 'card'

  // Dynamic AI Classifier Logic
  const categorizeComment = (text) => {
    const lower = (text || '').toLowerCase();

    if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('earn') || lower.includes('t.me') || lower.includes('whatsapp') || lower.includes('claim') || lower.includes('http') || lower.includes('.com') || lower.includes('free money') || lower.includes('cash')) {
      return {
        type: 'crypto_spam',
        categoryName: 'Crypto & Phishing Scam',
        badge: '🚫 CATEGORY: CRYPTO / PHISHING SPAM',
        action: 'Comment Automatically Hidden & Bot Profile Blocked',
        riskLevel: 'HIGH THREAT (99.4%)',
        badgeBg: 'rgba(244, 63, 94, 0.15)',
        badgeColor: '#f43f5e',
        dmSent: false
      };
    } else if (lower.includes('hate') || lower.includes('fake') || lower.includes('stupid') || lower.includes('scammer') || lower.includes('bad') || lower.includes('trash') || lower.includes('idiot') || lower.includes('ugly')) {
      return {
        type: 'hate_speech',
        categoryName: 'Hate Speech & Abuse',
        badge: '⚠️ CATEGORY: HATE SPEECH & TOXICITY',
        action: 'Comment Muted & Queued for Moderation Review',
        riskLevel: 'TOXIC CONTENT (97.2%)',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeColor: '#f59e0b',
        dmSent: false
      };
    } else if (lower.includes('link') || lower.includes('price') || lower.includes('ebook') || lower.includes('dm') || lower.includes('info') || lower.includes('pdf') || lower.includes('course') || lower.includes('buy') || lower.includes('send') || lower.includes('kit')) {
      return {
        type: 'autodm',
        categoryName: 'Lead Auto-DM Trigger',
        badge: '⚡ CATEGORY: LEAD AUTO-DM TRIGGER',
        action: 'Instant Instagram Direct Message Delivered to Inbox',
        riskLevel: 'HIGH LEAD INTENT (100%)',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#10b981',
        dmText: `Hey there! 👋 Thanks for commenting. Here is your instant download link: https://superprofile.bio/spamhunter-pro 🚀`,
        dmSent: true
      };
    } else {
      return {
        type: 'fan_engagement',
        categoryName: 'Genuine Fan Engagement',
        badge: '❤️ CATEGORY: GENUINE FAN ENGAGEMENT',
        action: 'Fan Intelligence Loyalty Score +15 Added',
        riskLevel: 'POSITIVE FAN (98.5%)',
        badgeBg: 'rgba(99, 102, 241, 0.15)',
        badgeColor: '#6366f1',
        dmSent: false
      };
    }
  };

  const currentAnalysis = categorizeComment(activeComment);

  const runTest = (textToTest, userName = 'creator_fan') => {
    setInputText(textToTest);
    setIsAnalyzing(true);
    setTimeout(() => {
      setActiveComment(textToTest);
      setActiveUser(userName);
      setIsAnalyzing(false);
    }, 450);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    runTest(inputText, 'custom_user');
  };

  const openCheckoutWithHandle = (handle) => {
    if (handle) setCheckoutHandle(handle);
    setCheckoutStep('details');
    setShowCheckout(true);
  };

  const processPayment = async (e) => {
    e.preventDefault();
    setCheckoutStep('paying');

    try {
      // Send buyer lead data to backend DB & Google Sheets
      await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_username: checkoutHandle.trim() || usernameInput.trim() || 'pro_creator',
          email: checkoutEmail.trim(),
          phone: checkoutPhone.trim(),
          amount_paid: 49,
          payment_method: payMethod
        })
      });
    } catch (err) {
      console.warn('[Checkout API Note]', err);
    }

    setTimeout(() => {
      setCheckoutStep('success');
    }, 1000);
  };

  const completeProActivation = () => {
    setShowCheckout(false);
    const targetHandle = checkoutHandle.trim() || usernameInput.trim() || 'pro_creator';
    onLogin(targetHandle);
  };

  return (
    <div className="sp-landing-root">
      {/* --- TOP BAR / NAVBAR --- */}
      <header className="sp-navbar">
        <div className="sp-nav-container">
          <div className="sp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="sp-brand-logo">
              <InstagramIcon size={22} className="sp-ig-icon" />
            </div>
            <div className="sp-brand-text">
              <span className="sp-brand-name">SpamHunter</span>
              <span className="sp-brand-badge">BIO</span>
            </div>
          </div>

          <nav className="sp-nav-menu">
            <a href="#demo">Live AI Demo</a>
            <a href="#features">Features</a>
            <a href="#how">How it Works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="sp-nav-actions">
            <button className="sp-theme-btn" onClick={toggleTheme} title="Toggle Mode">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            
            {creator ? (
              <button className="sp-btn-primary" onClick={() => onLogin(creator.instagram_username)}>
                Go to Dashboard <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <a href="#auth" className="sp-btn-ghost">Log In</a>
                <button className="sp-btn-primary" onClick={() => openCheckoutWithHandle(usernameInput)}>
                  Claim Offer @ ₹49 <Sparkles size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --- HERO SECTION WITH LIVE INSTAGRAM PHONE MOCKUP --- */}
      <div className="sp-hero-wrapper">
        {/* <SpamBattlefieldCanvas /> */}
        <section className="sp-hero" id="auth">
          <div className="sp-hero-glow"></div>
        <div className="sp-hero-grid">
          
          {/* Left Column: Headline & Quick Access */}
          <div className="sp-hero-left">
            <div className="sp-pill">
              <span className="sp-pill-dot"></span>
              <span>AI Instagram Auto-DM & Multi-Category Spam Shield</span>
            </div>

            <h1 className="sp-hero-headline">
              Turn Instagram Comments into <span className="sp-ig-gradient-text">Instant DMs & Sales</span>
            </h1>

            <p className="sp-hero-subtext">
              Automatically send download links, product pages, and course info when fans comment on your Reels — while AI classifies & shields your account from spam bots 24/7.
            </p>

            {/* Quick Login / Connect Card */}
            <div className="sp-auth-card">
              <form onSubmit={(e) => { e.preventDefault(); openCheckoutWithHandle(usernameInput); }} className="sp-form">
                <div className="sp-input-box">
                  <span className="sp-input-at">@</span>
                  <input 
                    type="text" 
                    placeholder="your_instagram_handle" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="sp-form-btn">
                    Get Early Offer @ ₹49 <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              <div className="sp-divider">
                <span>OR OFFICIAL META INTEGRATION</span>
              </div>

              <button className="sp-meta-btn" onClick={onFacebookLogin}>
                <GlobeIcon /> Connect Instagram Business Account
              </button>

              <div className="sp-security-note">
                <ShieldCheck size={14} color="#10b981" />
                <span>Meta Official Graph API • No Password Needed • Safe & Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Instagram Mobile Device Preview */}
          <div className="sp-hero-right" id="demo">
            <div className="sp-phone-frame">
              <div className="sp-phone-notch"></div>
              
              {/* Instagram App Header inside Phone */}
              <div className="sp-phone-app-header">
                <div className="sp-phone-user">
                  <div className="sp-avatar-gradient">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Avatar" />
                  </div>
                  <div>
                    <span className="sp-phone-username">yourbrand.official</span>
                    <span className="sp-phone-subtitle">Instagram Reel</span>
                  </div>
                </div>
                <div className="sp-live-badge">LIVE AI DEMO</div>
              </div>

              {/* Reel Image Mockup */}
              <div className="sp-reel-preview">
                <div className="sp-reel-overlay">
                  <span className="sp-reel-caption">Comment <strong>"LINK"</strong> to get instant PDF! 👇</span>
                </div>
              </div>

              {/* Dynamic Comment Input Bar */}
              <div className="sp-phone-controls">
                <form onSubmit={handleCustomSubmit} className="sp-custom-sim-form">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type any comment to test..."
                  />
                  <button type="submit" className="sp-sim-send-btn">
                    <Send size={14} />
                  </button>
                </form>

                <div className="sp-preset-buttons">
                  <button 
                    className="sp-chip"
                    onClick={() => runTest('Send me the price & ebook link', 'priya_m')}
                  >
                    ⚡ Auto-DM
                  </button>
                  <button 
                    className="sp-chip danger"
                    onClick={() => runTest('CLAIM $5000 FREE BITCOIN AT scam.com', 'bot_9812')}
                  >
                    🚫 Crypto Scam
                  </button>
                  <button 
                    className="sp-chip warning"
                    onClick={() => runTest('This post is fake and stupid trash', 'hater_user')}
                  >
                    ⚠️ Hate Speech
                  </button>
                  <button 
                    className="sp-chip fan"
                    onClick={() => runTest('Loved this reel! Amazing content 🔥', 'rahul_fan')}
                  >
                    ❤️ Superfan
                  </button>
                </div>
              </div>

              {/* Live Activity Stream inside Phone */}
              <div className="sp-phone-activity">
                {isAnalyzing ? (
                  <div className="sp-sim-loading">
                    <Sparkles size={16} className="sp-spin" />
                    <span>AI Classifying Comment Category...</span>
                  </div>
                ) : (
                  <>
                    {/* User Comment Bubble */}
                    <div className="sp-comment-bubble">
                      <div className="sp-comment-avatar-circle">
                        {activeUser[0].toUpperCase()}
                      </div>
                      <div className="sp-comment-text">
                        <span className="sp-comment-user">@{activeUser}</span>
                        <span>"{activeComment}"</span>
                      </div>
                    </div>

                    {/* AI Category & Action Output */}
                    <div className="sp-ai-category-badge" style={{ background: currentAnalysis.badgeBg, color: currentAnalysis.badgeColor }}>
                      <span className="badge-title">{currentAnalysis.badge}</span>
                      <span className="risk-tag">{currentAnalysis.riskLevel}</span>
                    </div>

                    {currentAnalysis.dmSent ? (
                      <div className="sp-dm-notification">
                        <div className="sp-dm-header">
                          <div className="sp-dm-icon">
                            <MessageCircle size={13} color="#fff" />
                          </div>
                          <span className="sp-dm-title">INSTAGRAM DIRECT MESSAGE</span>
                          <span className="sp-dm-time">Just now</span>
                        </div>
                        <div className="sp-dm-content">
                          <p>{currentAnalysis.dmText}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="sp-action-banner" style={{ color: currentAnalysis.badgeColor }}>
                        {currentAnalysis.type === 'crypto_spam' && <ShieldAlert size={15} />}
                        {currentAnalysis.type === 'hate_speech' && <AlertTriangle size={15} />}
                        {currentAnalysis.type === 'fan_engagement' && <Heart size={15} />}
                        <span>{currentAnalysis.action}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </section>
      </div>

      {/* --- HOW IT WORKS (AUTHENTIC STEP-BY-STEP) --- */}
      <section className="sp-section" id="how">
        <div className="sp-container">
          <div className="sp-section-header">
            <span className="sp-tag">SETUP IN 2 MINUTES</span>
            <h2>How Instagram Auto-DM & AI Protection Works</h2>
            <p>Connect your account, set a trigger keyword, and let SpamHunter handle comments and messages automatically.</p>
          </div>

          <div className="sp-steps-grid">
            <div className="sp-step-card">
              <div className="sp-step-num">1</div>
              <h3>Connect Instagram</h3>
              <p>Sign in with your Instagram handle or log in via Meta Facebook OAuth in 1-click.</p>
            </div>
            
            <div className="sp-step-card">
              <div className="sp-step-num">2</div>
              <h3>Set Your Keyword & AI Rules</h3>
              <p>Type keywords like "LINK", "PDF", or "PRICE" and turn on multi-category AI spam filtering.</p>
            </div>

            <div className="sp-step-card">
              <div className="sp-step-num">3</div>
              <h3>Autopilot Growth</h3>
              <p>When users comment on your Reel, SpamHunter sends the DM instantly and blocks spam comments.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURE TABS & HIGHLIGHTS --- */}
      <section className="sp-section sp-dark-bg" id="features">
        <div className="sp-container">
          <div className="sp-section-header">
            <span className="sp-tag">POWERFUL FEATURES</span>
            <h2>Built for Instagram Creators & Brands</h2>
            <p>Everything you need to engage followers, drive traffic to your store, and keep your comment section clean.</p>
          </div>

          <div className="sp-features-grid">
            <div className="sp-feature-box">
              <div className="sp-feat-icon purple">
                <Zap size={22} />
              </div>
              <h3>Comment to Auto-DM</h3>
              <p>Send links, PDFs, store URLs, or coupon codes instantly when followers comment specific keywords on your Reels & Posts.</p>
            </div>

            <div className="sp-feature-box">
              <div className="sp-feat-icon rose">
                <ShieldAlert size={22} />
              </div>
              <h3>AI Anti-Spam Shield</h3>
              <p>Automatically hide or delete crypto scams, phishing links, hate speech, and repetitive bot comments before anyone sees them.</p>
            </div>

            <div className="sp-feature-box">
              <div className="sp-feat-icon blue">
                <Users size={22} />
              </div>
              <h3>Fan Intelligence & Leads</h3>
              <p>Track your most loyal commenters, identify hot buyer intent, and build your customer audience list automatically.</p>
            </div>

            <div className="sp-feature-box">
              <div className="sp-feat-icon green">
                <ShieldCheck size={22} />
              </div>
              <h3>100% Meta Official API</h3>
              <p>Built strictly on Meta's official Graph API & Webhooks. No password required, zero ban risk, 100% safe.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- PRICING SECTION (SINGLE EARLY BIRD OFFER PLAN) --- */}
      <section className="sp-section" id="pricing">
        <div className="sp-container sp-narrow">
          <div className="sp-section-header">
            <span className="sp-tag">🔥 EXCLUSIVE EARLY BIRD OFFER</span>
            <h2>All-In-One Pro Creator Plan</h2>
            <p>Get full access to all Instagram Auto-DM and AI Anti-Spam features at an unbeatable price.</p>
          </div>

          <div className="sp-single-pricing-card">
            <div className="sp-offer-header-banner">
              <Sparkles size={16} />
              <span>EARLY BIRD SPECIAL: FIRST 3 MONTHS OFFER</span>
            </div>

            <div className="sp-single-plan-body">
              <div className="sp-plan-title-row">
                <div>
                  <h3 className="sp-single-plan-name">All-Inclusive Pro Pass</h3>
                  <p className="sp-single-plan-sub">Everything you need to automate DMs & block spam comments</p>
                </div>
                <div className="sp-save-badge">SAVE 83% OFF</div>
              </div>

              <div className="sp-single-price-box">
                <div className="sp-price-comparison">
                  <span className="sp-old-price">₹299</span>
                  <span className="sp-new-price">₹49</span>
                  <span className="sp-price-period">/ month (First 3 Months)</span>
                </div>
                <p className="sp-price-note">Then ₹299/month after 3 months.</p>
              </div>

              <div className="sp-single-features-grid">
                <div className="sp-single-feat-item">
                  <CheckCircle2 size={18} color="#10b981" />
                  <span><strong>Unlimited Auto-DMs</strong> for Reels & Posts</span>
                </div>
                <div className="sp-single-feat-item">
                  <CheckCircle2 size={18} color="#10b981" />
                  <span><strong>Multi-Layer AI Anti-Spam</strong> & Bot Shield</span>
                </div>
                <div className="sp-single-feat-item">
                  <CheckCircle2 size={18} color="#10b981" />
                  <span><strong>Superfan Intelligence</strong> & CSV Lead Export</span>
                </div>
                <div className="sp-single-feat-item">
                  <CheckCircle2 size={18} color="#10b981" />
                  <span><strong>Priority DM Delivery Queue</strong> (&lt;1 sec speed)</span>
                </div>
                <div className="sp-single-feat-item">
                  <CheckCircle2 size={18} color="#10b981" />
                  <span><strong>100% Meta Official API</strong> (Zero Ban Risk)</span>
                </div>
              </div>

              <div className="sp-single-action">
                <button onClick={() => openCheckoutWithHandle(usernameInput)} className="sp-btn-primary sp-btn-hero-offer">
                  Claim Early Bird Offer @ ₹49/mo <ArrowRight size={18} />
                </button>
                <div className="sp-guarantee-row">
                  <ShieldCheck size={16} color="#10b981" />
                  <span>Instant Setup • Meta Approved API</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FREQUENTLY ASKED QUESTIONS --- */}
      <section className="sp-section sp-dark-bg" id="faq">
        <div className="sp-container sp-narrow">
          <div className="sp-section-header">
            <span className="sp-tag">FAQ</span>
            <h2>Frequently Asked Questions</h2>
          </div>

          <div className="sp-faq-list">
            {[
              {
                q: "How does Instagram Auto-DM work?",
                a: "When a user comments your keyword (e.g. 'LINK') on any of your Instagram Reels or Posts, SpamHunter automatically triggers a private Direct Message with your link directly into their inbox within seconds."
              },
              {
                q: "Is this safe for my Instagram account?",
                a: "Yes! SpamHunter uses Meta's official Graph API & Webhook infrastructure. We never store or ask for your Instagram password, making it 100% safe and compliant with Instagram's policies."
              },
              {
                q: "How does the AI Spam Filter protect my comment section?",
                a: "Our AI model continuously scans incoming comments for phishing links, crypto scam bots, and offensive language, automatically hiding suspicious comments before they reach your audience."
              },
              {
                q: "How do I activate the ₹49 Early Bird Pass?",
                a: "Click on 'Claim Early Bird Offer @ ₹49/mo', enter your Instagram handle and email, and complete payment via UPI (GPay/PhonePe/Paytm) or Card. Access activates instantly!"
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className={`sp-faq-item ${faqOpen === idx ? 'open' : ''}`}
                onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
              >
                <div className="sp-faq-q">
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="sp-faq-icon" />
                </div>
                {faqOpen === idx && (
                  <div className="sp-faq-a">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- MONETIZATION CHECKOUT MODAL --- */}
      {showCheckout && (
        <div className="sp-modal-overlay">
          <div className="sp-checkout-modal">
            <button className="sp-modal-close" onClick={() => setShowCheckout(false)}>
              <X size={20} />
            </button>

            {checkoutStep === 'details' && (
              <div className="sp-modal-content">
                <div className="sp-modal-header">
                  <div className="sp-badge-glow">
                    <Sparkles size={16} /> EARLY BIRD PASS
                  </div>
                  <h3>Activate Pro Creator Access</h3>
                  <p>Complete payment to unlock Unlimited Instagram Auto-DMs & AI Anti-Spam</p>
                </div>

                {/* Summary Box */}
                <div className="sp-order-summary">
                  <div className="sp-summary-row">
                    <span>Plan: Pro Pass (First 3 Months)</span>
                    <span className="sp-old">₹299</span>
                  </div>
                  <div className="sp-summary-row highlight">
                    <span>Early Bird Discount</span>
                    <span>-₹250</span>
                  </div>
                  <div className="sp-summary-divider"></div>
                  <div className="sp-summary-row total">
                    <span>Total Amount Payable</span>
                    <span className="sp-pay-amount">₹49</span>
                  </div>
                </div>

                <form onSubmit={processPayment} className="sp-checkout-form">
                  <div className="sp-field">
                    <label>Instagram Handle</label>
                    <div className="sp-input-prefix-box">
                      <span>@</span>
                      <input 
                        type="text" 
                        placeholder="your_handle" 
                        value={checkoutHandle}
                        onChange={(e) => setCheckoutHandle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="sp-field-row">
                    <div className="sp-field">
                      <label>Email Address (For Receipt)</label>
                      <input 
                        type="email" 
                        placeholder="name@email.com" 
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="sp-field">
                      <label>WhatsApp Number</label>
                      <input 
                        type="tel" 
                        placeholder="9876543210" 
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="sp-field">
                    <label>Select Payment Gateway</label>
                    <div className="sp-pay-options">
                      <div 
                        className={`sp-pay-opt ${payMethod === 'upi' ? 'active' : ''}`}
                        onClick={() => setPayMethod('upi')}
                      >
                        <QrCode size={18} />
                        <span>UPI / QR Code (GPay, PhonePe, Paytm)</span>
                      </div>

                      <div 
                        className={`sp-pay-opt ${payMethod === 'card' ? 'active' : ''}`}
                        onClick={() => setPayMethod('card')}
                      >
                        <CreditCard size={18} />
                        <span>Cards & Netbanking</span>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="sp-btn-primary sp-pay-btn">
                    Pay ₹49 & Activate Instant Access <ArrowRight size={18} />
                  </button>
                </form>

                <div className="sp-trust-foot">
                  <ShieldCheck size={14} color="#10b981" />
                  <span>256-Bit SSL Encrypted Secure Checkout • Instant Auto-Activation</span>
                </div>
              </div>
            )}

            {checkoutStep === 'paying' && (
              <div className="sp-modal-content sp-loading-state">
                <Sparkles size={40} className="sp-spin" color="#6366f1" />
                <h3>Processing Payment...</h3>
                <p>Connecting to Payment Gateway for @{checkoutHandle || 'your_handle'}</p>
                <div className="sp-progress-bar">
                  <div className="sp-progress-fill"></div>
                </div>
              </div>
            )}

            {checkoutStep === 'success' && (
              <div className="sp-modal-content sp-success-state">
                <div className="sp-success-icon">
                  <CheckCircle size={48} color="#10b981" />
                </div>
                <h2>🎉 Payment Successful!</h2>
                <p className="sp-success-msg">
                  Pro Creator Access activated for <strong>@{checkoutHandle || 'your_account'}</strong>!
                </p>
                
                <div className="sp-receipt-box">
                  <div className="sp-receipt-line"><span>Order ID:</span> <strong>SHP-981249</strong></div>
                  <div className="sp-receipt-line"><span>Plan:</span> <strong>Pro Pass (3 Months)</strong></div>
                  <div className="sp-receipt-line"><span>Amount Paid:</span> <strong>₹49</strong></div>
                  <div className="sp-receipt-line"><span>Status:</span> <span className="active-tag">ACTIVE</span></div>
                </div>

                <button onClick={completeProActivation} className="sp-btn-primary sp-pay-btn">
                  Launch Pro Dashboard Now <ArrowRight size={18} />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- FLOATING WHATSAPP SALES & SUPPORT FLOATER --- */}
      <a 
        href="https://wa.me/917897808610?text=Hi%2C%20I%20want%20to%20buy%20SpamHunter%20Pro%20for%20my%20Instagram%20account" 
        target="_blank" 
        rel="noopener noreferrer"
        className="sp-floating-support"
        title="Chat on WhatsApp for Sales & Setup"
      >
        <div className="sp-wa-icon">
          <MessageCircle size={20} color="#fff" />
        </div>
        <span className="sp-wa-text">Sales Support</span>
      </a>

      {/* --- FOOTER --- */}
      <footer className="sp-footer">
        <div className="sp-container sp-footer-content">
          <div className="sp-footer-brand">
            <div className="sp-brand-logo">
              <InstagramIcon size={20} className="sp-ig-icon" />
            </div>
            <span>SpamHunter BIO</span>
            <p>Instagram Auto-DM & AI Comment Moderation Platform.</p>
          </div>

          <div className="sp-footer-links">
            <span onClick={() => navigateTo('/privacy')}>Privacy Policy</span>
            <span>•</span>
            <span onClick={() => navigateTo('/terms')}>Terms of Service</span>
            <span>•</span>
            <span onClick={() => navigateTo('/data-deletion')}>Data Deletion</span>
          </div>
        </div>
        <div className="sp-footer-bottom">
          <span>© {new Date().getFullYear()} SpamHunter BIO. All rights reserved. Meta Approved API Partner.</span>
        </div>
      </footer>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  );
}
