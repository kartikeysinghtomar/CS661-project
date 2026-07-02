import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-grad-1 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="font-extrabold text-xl">🇮🇳 CensusScope</span>
          <nav className="flex items-center gap-5 text-sm text-white/85">
            <Link href="/atlas" className="hover:text-white transition-colors">Explorer</Link>
            <Link href="/compose" className="hover:text-white transition-colors">Composite</Link>
          </nav>
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur mb-8">
            Census of India · 2011
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight max-w-4xl mx-auto">
            Explore India&apos;s demographics,
            <br /> state by state, district by district.
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
            Interactive choropleth maps, rankings, multi-state comparisons and instant insights across
            35 states &amp; UTs, 640 districts and 80+ socioeconomic indicators.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/atlas"
              className="rounded-xl bg-white text-brand-700 font-semibold px-7 py-3.5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
            >
              Open the Explorer →
            </Link>
            <Link
              href="/compose"
              className="rounded-xl bg-white/15 backdrop-blur font-semibold px-7 py-3.5 hover:bg-white/25 transition-colors"
            >
              Build a Composite Index
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 -mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { n: "35", l: "States & UTs" },
            { n: "640", l: "Districts" },
            { n: "80+", l: "Indicators" },
            { n: "3", l: "Analysis views" },
          ].map((s) => (
            <div key={s.l} className="card card-hover text-center py-7">
              <div className="text-4xl font-extrabold text-brand-600">{s.n}</div>
              <div className="eyebrow mt-2">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold text-center mb-3">Three ways to read the data</h2>
        <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
          Every view is interactive — pick a metric and watch the country reshuffle.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <Feature
            grad="grad-3"
            icon="🗺️"
            title="State Analysis"
            body="Choropleth map, live rankings, age breakdown, distribution, top performers, correlation heatmap and key insights for any indicator."
          />
          <Feature
            grad="grad-4"
            icon="🏘️"
            title="District Analysis"
            body="Drill into any state: district-level map, rankings, a performance matrix scatter and a searchable summary table."
          />
          <Feature
            grad="grad-5"
            icon="📊"
            title="Comparison"
            body="Put 2–5 states side by side — bar charts, a multi-dimensional radar, development-pathway analysis and tailored recommendations."
          />
        </div>
        <div className="text-center mt-12">
          <Link
            href="/atlas"
            className="inline-flex rounded-xl bg-grad-6 text-white font-semibold px-8 py-3.5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
          >
            Launch the Explorer
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-slate-400 text-sm">
        Data: Census of India, 2011 · Built with Next.js + FastAPI
      </footer>
    </main>
  );
}

function Feature({ grad, icon, title, body }: { grad: string; icon: string; title: string; body: string }) {
  return (
    <div className="card card-hover">
      <span className="chip text-xl mb-4" style={{ background: `var(--${grad})` }}>
        {icon}
      </span>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">{body}</p>
    </div>
  );
}
