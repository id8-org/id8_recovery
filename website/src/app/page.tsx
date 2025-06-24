"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - email will be sent via MailHog
        console.log('Signup successful:', data.message);
      } else {
        // Error
        console.error('Signup failed:', data.error);
        setSubmitted(false); // Allow retry
      }
    } catch (error) {
      console.error('Network error:', error);
      setSubmitted(false); // Allow retry
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col">
      {/* Hero Section */}
      <section className="w-full flex flex-col items-center justify-center py-24 px-4 bg-gradient-to-b from-blue-100 to-white relative overflow-hidden">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="flex flex-col items-center max-w-2xl mx-auto text-center z-10">
          <Image src="/assets/logo.png" alt="ID8 logo" width={80} height={80} className="mb-4" />
          <h1 className="text-5xl md:text-6xl font-extrabold text-blue-900 mb-6 leading-tight drop-shadow">Unlock Your Next Big Idea with ID8</h1>
          <p className="text-xl md:text-2xl text-slate-700 mb-10">AI-powered idea generation, validation, and deep dives for founders, makers, and innovators. Discover, refine, and launch your next venture—faster than ever.</p>
          <a
            href="http://localhost:8081/" // TODO: update to your actual app URL if different
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 rounded-lg bg-orange-500 text-white font-bold text-lg shadow-lg hover:scale-105 hover:bg-orange-600 transition-all duration-200 mb-4 focus:outline-none focus:ring-4 focus:ring-orange-300"
          >
            Go to App
          </a>
          <span className="text-slate-500 text-sm mt-2">No signup required to explore the app</span>
        </motion.div>
        {/* Animated background shapes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} transition={{ duration: 1 }} className="absolute -top-32 -left-32 w-96 h-96 bg-blue-900 rounded-full blur-3xl z-0" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={{ duration: 1.2 }} className="absolute -bottom-32 -right-32 w-96 h-96 bg-orange-400 rounded-full blur-3xl z-0" />
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">How ID8 Works</motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: "💡",
              title: "Personalized Idea Generation",
              desc: "Tell us your skills and interests. ID8's AI crafts tailored, non-obvious startup ideas just for you."
            },
            {
              icon: "🔬",
              title: "Deep Dive Analysis",
              desc: "Get instant market, product, and funding insights—no more guesswork."
            },
            {
              icon: "🚀",
              title: "Refine & Launch",
              desc: "Iterate, validate, and move your best ideas forward—all in one place."
            }
          ].map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.5 }} className="bg-white rounded-xl shadow p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow border border-blue-100">
              <span className="text-4xl mb-3">{step.icon}</span>
              <h3 className="text-xl font-semibold mb-2 text-blue-900">{step.title}</h3>
              <p className="text-slate-700">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features/Benefits */}
      <section className="py-20 px-4 bg-blue-50">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">Why ID8?</motion.h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              icon: "⚡️",
              title: "Lightning Fast",
              desc: "Go from zero to validated idea in minutes, not months."
            },
            {
              icon: "🎯",
              title: "Hyper-Personalized",
              desc: "Ideas and insights tailored to your unique background and goals."
            },
            {
              icon: "🤝",
              title: "Collaborative",
              desc: "Invite cofounders, get feedback, and iterate together."
            }
          ].map((feature, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.5 }} className="bg-white rounded-xl shadow p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow border border-blue-100">
              <span className="text-4xl mb-3">{feature.icon}</span>
              <h3 className="text-xl font-semibold mb-2 text-blue-900">{feature.title}</h3>
              <p className="text-slate-700">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Plans & Account Types */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">Plans & Account Types</motion.h2>
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Free Tier */}
          <div className="bg-white rounded-xl shadow p-8 flex flex-col items-center border border-blue-100">
            <span className="text-3xl mb-2 font-bold text-blue-900">Free</span>
            <span className="text-lg text-blue-500 mb-4">Get started at no cost</span>
            <ul className="text-slate-700 space-y-2 mb-4">
              <li>✅ Unlimited idea generation</li>
              <li>✅ Basic deep dive analysis</li>
              <li>✅ Solo account</li>
              <li>✅ Community support</li>
            </ul>
            <span className="text-xs text-slate-500">Perfect for exploring and validating your first ideas.</span>
          </div>
          {/* Premium Tier */}
          <div className="bg-white rounded-xl shadow p-8 flex flex-col items-center border border-orange-200">
            <span className="text-3xl mb-2 font-bold text-orange-500">Premium</span>
            <span className="text-lg text-orange-400 mb-4">Unlock advanced features</span>
            <ul className="text-slate-700 space-y-2 mb-4">
              <li>✨ Everything in Free, plus:</li>
              <li>✨ Advanced deep dives (market, funding, product, moat)</li>
              <li>✨ Team accounts & collaboration</li>
              <li>✨ Priority support</li>
              <li>✨ Export & integration tools</li>
            </ul>
            <span className="text-xs text-slate-500">For founders, teams, and power users ready to launch and scale.</span>
          </div>
        </div>
        {/* Account Types */}
        <div className="flex flex-col md:flex-row gap-8 justify-center">
          {/* Solo Account */}
          <div className="flex-1 bg-white rounded-xl shadow p-6 flex flex-col items-center border border-blue-100">
            <span className="text-2xl font-semibold text-blue-900 mb-2">Solo Account</span>
            <p className="text-slate-700 text-center mb-2">For individual founders, makers, and creators. All the tools you need to go from idea to launch—on your own terms.</p>
            <span className="text-xs text-slate-500">Upgrade anytime to unlock team features.</span>
          </div>
          {/* Team Account */}
          <div className="flex-1 bg-white rounded-xl shadow p-6 flex flex-col items-center border border-orange-200">
            <span className="text-2xl font-semibold text-orange-500 mb-2">Team Account</span>
            <p className="text-slate-700 text-center mb-2">Collaborate with cofounders, teammates, or advisors. Share ideas, feedback, and deep dives in a secure workspace.</p>
            <span className="text-xs text-slate-500">Available on Premium. Perfect for startups and innovation teams.</span>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">What Founders Are Saying</motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Alex P.",
              quote: "ID8 gave me the confidence to pursue my idea—and the roadmap to make it real!",
              avatar: "/assets/logo.png"
            },
            {
              name: "Samira K.",
              quote: "The deep dives are like having a team of analysts in my pocket.",
              avatar: "/assets/logo.png"
            },
            {
              name: "Jordan L.",
              quote: "I found my cofounder through ID8's collaboration tools!",
              avatar: "/assets/logo.png"
            }
          ].map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.5 }} className="bg-white rounded-xl shadow p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow border border-blue-100">
              <Image src={t.avatar} alt={t.name} width={48} height={48} className="rounded-full mb-3" />
              <p className="italic text-slate-700 mb-2">&ldquo;{t.quote}&rdquo;</p>
              <span className="font-semibold text-blue-900">{t.name}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Screenshots/Demos */}
      <section className="py-20 px-4 bg-blue-100">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">See ID8 in Action</motion.h2>
        <div className="flex flex-wrap justify-center gap-8 max-w-5xl mx-auto">
          {[1, 2, 3].map(i => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.5 }} className="bg-white rounded-xl shadow p-4 w-80 h-56 flex items-center justify-center border border-blue-100">
              <span className="text-slate-700 text-lg">Screenshot Placeholder {i}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 max-w-3xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-3xl font-bold text-blue-900 text-center mb-12">Frequently Asked Questions</motion.h2>
        <div className="space-y-4">
          {[
            {
              q: "Is ID8 free to try?",
              a: "Yes! You can sign up and get early access for free. Premium features may be added later."
            },
            {
              q: "Who is ID8 for?",
              a: "Founders, makers, and anyone looking to turn skills into real startup opportunities."
            },
            {
              q: "How does the AI work?",
              a: "ID8 uses advanced LLMs and proprietary prompts to generate, analyze, and refine ideas tailored to you."
            },
            {
              q: "Can I invite collaborators?",
              a: "Yes! Collaboration is a core part of ID8."
            }
          ].map((faq, i) => (
            <motion.details key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="bg-white rounded-lg shadow p-4 border border-blue-100 overflow-hidden transition-all duration-300 group">
              <summary className="font-semibold text-blue-900 cursor-pointer flex items-center justify-between mb-2 select-none focus:outline-none focus:ring-2 focus:ring-blue-300">
                <span>{faq.q}</span>
                <svg className="w-5 h-5 ml-2 transition-transform duration-300 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="max-h-0 group-open:max-h-40 transition-all duration-300 overflow-hidden">
                <p className="text-slate-700 mt-2">{faq.a}</p>
              </div>
            </motion.details>
          ))}
        </div>
      </section>

      {/* Mailing List Signup - moved here for more impact */}
      <section className="py-16 px-4 bg-white border-t border-blue-100 flex flex-col items-center">
        <h3 className="text-2xl font-bold text-blue-900 mb-2">Get Early Access & Updates</h3>
        <p className="text-slate-700 mb-6 text-center max-w-xl">Join our mailing list for launch updates, new features, and exclusive tips for founders and makers. No spam, ever.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md mx-auto mb-2">
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 px-4 py-3 rounded border border-input focus:ring-2 focus:ring-primary outline-none bg-white text-base text-slate-900"
            disabled={submitted}
          />
          <button
            type="submit"
            className="px-6 py-3 rounded bg-blue-900 text-white font-semibold shadow hover:scale-105 transition-transform duration-200"
            disabled={submitted}
          >
            {submitted ? "Thank you!" : "Sign up"}
          </button>
        </form>
        {submitted && <span className="text-green-600 font-medium mt-2">You're on the list!</span>}
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-blue-900 text-white text-center mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto gap-4">
          <div className="flex items-center gap-2 justify-center">
            <Image src="/assets/logo.png" alt="ID8 logo" width={32} height={32} />
            <span className="font-bold text-lg">ID8</span>
          </div>
          <div className="flex gap-4 justify-center">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Terms of Service</a>
            <a href="#" className="hover:underline">Contact</a>
            <a href="https://app.id8.com" target="_blank" rel="noopener noreferrer" className="hover:underline">Go to App</a>
          </div>
          <div className="text-sm">&copy; {new Date().getFullYear()} ID8. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
