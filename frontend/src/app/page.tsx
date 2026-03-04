"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  FileSearch,
  MessagesSquare,
  Network,
  Shield,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
  type Variants,
} from "motion/react";

import { LogoIcon } from "@/components/logo";

/* ═══════════════════════ animation variants ═══════════════════════ */

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.7, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ═══════════════════════ UI sub-components ═══════════════════════ */

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}

function FeatureCard({ icon, title, description, index }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      rotateX.set(((e.clientY - centerY) / (rect.height / 2)) * -8);
      rotateY.set(((e.clientX - centerX) / (rect.width / 2)) * 8);
    },
    [rotateX, rotateY],
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60, rotateX: 10 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{
        duration: 0.7,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 800,
      }}
      className="group relative rounded-2xl border border-white/[0.06] bg-background/60 p-6 backdrop-blur-xl transition-colors duration-500 hover:border-primary/30 hover:bg-background/80"
    >
      <div className="relative">
        <motion.div
          className="mb-4 inline-flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-primary transition-all duration-300 group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:shadow-lg group-hover:shadow-primary/10"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {icon}
        </motion.div>
        <h3 className="mb-2 text-[15px] font-semibold text-foreground">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isLast: boolean;
}

function Step({ number, title, description, icon, isLast }: StepProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{
        duration: 0.7,
        delay: number * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative flex items-start gap-5"
    >
      {!isLast && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={isInView ? { scaleY: 1 } : {}}
          transition={{ duration: 0.8, delay: number * 0.15 + 0.3 }}
          className="absolute left-6 top-14 h-[calc(100%+8px)] w-[1px] origin-top bg-gradient-to-b from-primary/30 to-transparent"
        />
      )}

      <div className="relative flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : {}}
          transition={{
            duration: 0.4,
            delay: number * 0.15 + 0.2,
            type: "spring",
            stiffness: 400,
          }}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
        >
          {number}
        </motion.div>
      </div>
      <div className="pt-1">
        <h3 className="mb-1 text-[15px] font-semibold text-foreground">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className="mb-16 flex flex-col items-center text-center"
    >
      <motion.div
        variants={fadeUp}
        className="mb-4 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {badge}
        </span>
      </motion.div>
      <motion.h2
        variants={fadeUp}
        className="mb-4 max-w-lg text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={fadeUp}
        className="max-w-md text-[14px] leading-relaxed text-muted-foreground"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );
}

/* ── Animated counter ── */
function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const numericPart = parseInt(value.replace(/\D/g, ""), 10);
  const isNumeric = !isNaN(numericPart) && numericPart > 0;
  const [display, setDisplay] = useState(isNumeric ? "0" : value);

  useEffect(() => {
    if (!isInView || !isNumeric) {
      if (!isNumeric) setDisplay(value);
      return;
    }
    const end = numericPart;
    const duration = 1500;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * end);
      const prefix = value.startsWith("<") ? "< " : "";
      setDisplay(`${prefix}${current}${suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, isNumeric, numericPart, value, suffix]);

  return <span ref={ref}>{display}</span>;
}

/* ── Scrolling text band ── */
function ScrollingBand() {
  const words = [
    "REASONING",
    "INTELLIGENCE",
    "DOCUMENTS",
    "KNOWLEDGE",
    "INSIGHTS",
    "ANALYSIS",
    "UNDERSTANDING",
    "ARCHIVA",
  ];
  const repeated = [...words, ...words, ...words];

  return (
    <div className="relative overflow-hidden border-y border-white/[0.04] bg-background/80 py-5 backdrop-blur-sm">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-33.33%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {repeated.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="text-[13px] font-semibold tracking-[0.2em] text-muted-foreground/15"
          >
            {word}
            <span className="mx-8 text-primary/15">&middot;</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════ data ════════════════════════════════════ */

const FEATURES = [
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Reasoning, Not Search",
    description:
      "Goes beyond keyword matching. The AI agent understands context, connects ideas across documents, and synthesizes answers.",
  },
  {
    icon: <FileSearch className="h-5 w-5" />,
    title: "Deep Document Understanding",
    description:
      "Processes PDFs, spreadsheets, docs, and more. Extracts structure, meaning, and relationships automatically.",
  },
  {
    icon: <MessagesSquare className="h-5 w-5" />,
    title: "Conversational Interface",
    description:
      "Ask questions in natural language. Follow up, refine, and dive deeper — like talking to a knowledgeable colleague.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Instant Processing",
    description:
      "Documents are analyzed and categorized the moment they're uploaded. No waiting, no manual tagging.",
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: "Knowledge Graph",
    description:
      "Automatically maps relationships between documents, topics, and concepts across your entire workspace.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Private & Secure",
    description:
      "Your data stays yours. Self-hostable with local LLMs. No data leaves your infrastructure.",
  },
];

const STEPS = [
  {
    icon: <Upload className="h-5 w-5" />,
    title: "Upload your documents",
    description:
      "Drop PDFs, spreadsheets, docs — any format. Archiva ingests and processes them instantly.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "AI analyzes everything",
    description:
      "The agent extracts text, understands structure, categorizes content, and builds a knowledge map.",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Ask anything",
    description:
      "Chat with your documents. The agent reasons across all your files to give complete, cited answers.",
  },
];

/* ═══════════════════════ main page ═══════════════════════════════ */

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const { scrollYProgress: pageProgress } = useScroll();
  const smoothProgress = useSpring(pageProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const navBg = useTransform(
    smoothProgress,
    [0, 0.05],
    ["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"],
  );
  const navBorder = useTransform(
    smoothProgress,
    [0, 0.05],
    ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"],
  );

  return (
    <div className="relative min-h-screen bg-background">
      {/* ── Progress bar ── */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-primary"
        style={{ scaleX: smoothProgress }}
      />

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="fixed left-0 right-0 top-0 z-50 backdrop-blur-xl"
        style={{
          backgroundColor: navBg,
          borderBottom: "1px solid",
          borderColor: navBorder,
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <LogoIcon className="h-7 w-7" />
            </motion.div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Archiva
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                Get started
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-14"
      >
        <motion.div
          style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          className="relative z-10 flex flex-col items-center"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center gap-6"
          >
            {/* Badge */}
            <motion.div
              variants={fadeUp}
              className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 backdrop-blur-sm"
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold text-primary">
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles className="h-3 w-3" />
                </motion.span>
                AI-powered document intelligence
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="max-w-3xl text-center text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Your documents,{" "}
              <span className="relative inline-block">
                <span className="text-primary">understood</span>
                <motion.span
                  className="absolute -bottom-1.5 left-0 h-[3px] w-full rounded-full bg-primary"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: 0.8,
                    delay: 1.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: "left" }}
                />
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={fadeUp}
              className="max-w-lg text-center text-[16px] leading-relaxed text-muted-foreground"
            >
              Not a search tool — a reasoning system that reads, understands,
              and answers questions across your entire document library.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              className="mt-4 flex flex-col items-center gap-4 sm:flex-row"
            >
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center gap-2.5 rounded-xl bg-primary px-8 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/20"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-xl border border-white/[0.06] bg-background/60 px-8 text-[14px] font-medium text-foreground backdrop-blur-sm transition-all hover:border-white/[0.12] hover:bg-background/80"
                >
                  Sign in
                </Link>
              </motion.div>
            </motion.div>

            {/* Trust pills */}
            <motion.div variants={fadeUp} className="mt-6 flex items-center gap-3">
              {["Open source", "Self-hostable", "Local LLMs"].map(
                (item, i) => (
                  <motion.span
                    key={item}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 + i * 0.1 }}
                    className="rounded-full border border-white/[0.04] bg-background/40 px-3 py-1 text-[11px] text-muted-foreground/60 backdrop-blur-sm"
                  >
                    {item}
                  </motion.span>
                ),
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-9 w-5 items-start justify-center rounded-full border border-white/[0.1] p-1.5"
          >
            <motion.div
              className="h-2 w-1 rounded-full bg-primary/40"
              animate={{ y: [0, 10, 0], opacity: [0.4, 0.8, 0.4] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Scrolling text band ── */}
      <ScrollingBand />

      {/* ── Features ── */}
      <section className="relative px-6 py-32">
        <div className="relative mx-auto max-w-5xl">
          <SectionHeading
            badge="Capabilities"
            title="Intelligence built for organizations"
            subtitle="Everything you need to turn unstructured documents into actionable, queryable knowledge."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative overflow-hidden px-6 py-32">
        <div className="relative mx-auto max-w-3xl">
          <SectionHeading
            badge="How it works"
            title="From upload to insight in minutes"
            subtitle="Three steps to transform your document chaos into an organized, intelligent knowledge base."
          />
          <div className="flex flex-col gap-12">
            {STEPS.map((step, i) => (
              <Step
                key={step.title}
                number={i + 1}
                icon={step.icon}
                title={step.title}
                description={step.description}
                isLast={i === STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 gap-8 lg:grid-cols-4"
          >
            {[
              { value: "15+", label: "File formats supported", suffix: "+" },
              { value: "< 30s", label: "Average processing time", suffix: "s" },
              { value: "100%", label: "Private & self-hostable", suffix: "%" },
              { value: "0", label: "Data sent to third parties", suffix: "" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={scaleIn}
                className="group flex flex-col items-center text-center"
              >
                <span className="text-3xl font-bold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-4xl">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </span>
                <span className="mt-1 text-[13px] text-muted-foreground">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Scrolling band 2 ── */}
      <ScrollingBand />

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden px-6 py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="relative mx-auto flex max-w-2xl flex-col items-center text-center"
        >
          <motion.div variants={scaleIn} className="mb-6">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"
            >
              <Brain className="h-8 w-8" />
            </motion.div>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Ready to unlock your
            <br />
            <span className="text-primary">
              organization&apos;s knowledge?
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mb-8 max-w-md text-[14px] leading-relaxed text-muted-foreground"
          >
            Stop searching. Start reasoning. Let an AI agent that understands
            your documents give you the answers you need.
          </motion.p>
          <motion.div variants={fadeUp}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/signup"
                className="group inline-flex h-14 items-center gap-2.5 rounded-xl bg-primary px-10 text-[15px] font-semibold text-primary-foreground shadow-xl shadow-primary/15 transition-all hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/20"
              >
                Get started for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoIcon className="h-6 w-6" />
            <span className="text-[13px] font-semibold text-foreground">
              Archiva
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground/60">
            Open source AI document intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
