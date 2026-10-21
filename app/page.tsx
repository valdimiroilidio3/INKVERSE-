import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Boxes, Layers, MousePointerClick, Sparkles } from 'lucide-react';
import { HeroStage } from '@/components/site/HeroStage';
import { Marquee } from '@/components/site/Marquee';
import { SectionHeading } from '@/components/site/SectionHeading';
import { TattooCard } from '@/components/gallery/TattooCard';
import { ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { FEATURED_DESIGNS, TATTOO_LIBRARY, STYLE_COUNTS } from '@/lib/tattoos';
import { STYLE_LABELS, TATTOO_STYLES } from '@/lib/types';
import { CHARACTERS } from '@/lib/characters';
import { REGION_LABELS } from '@/lib/regions';

const PRINCIPLES = [
  {
    index: '01',
    icon: Boxes,
    title: 'Real 3D body',
    body: 'Two studio characters built on a licensed anatomical mesh. Orbit 360°, zoom, and switch between front, back and profile without losing your composition.',
  },
  {
    index: '02',
    icon: Layers,
    title: 'Ink on the surface',
    body: 'Designs are placed in UV space and composited in the skin shader, so every line follows the curvature of the body — not a plane floating in front of it.',
  },
  {
    index: '03',
    icon: MousePointerClick,
    title: 'Editorial, not dashboard',
    body: 'A dark studio interface with restrained controls. Seventeen mapped body zones, eight independent layers, and an export that is honest about what it is.',
  },
];

export default function HomePage() {
  const featured = FEATURED_DESIGNS.slice(0, 6);
  const hero = TATTOO_LIBRARY.find((d) => d.id === 'lunar-moth') ?? TATTOO_LIBRARY[0]!;
  const regions = Object.keys(REGION_LABELS).length;

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative min-h-[92svh] overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_62%_20%,#1c1c1d_0%,#0b0b0c_46%,#060607_100%)]" />
        <div className="absolute inset-y-0 right-0 w-full lg:w-[62%]">
          <HeroStage poster="/editorial/hero-atlas.webp" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/40 to-transparent lg:from-ink-900 lg:via-ink-900/15" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-900 to-transparent" />
        </div>

        <div className="page-max page-x relative flex min-h-[92svh] flex-col justify-between pb-10 pt-[calc(var(--header-h)+2.5rem)]">
          <div className="max-w-[46rem]">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-acid" />
              <span className="label-caps text-[10px] text-paper-dim">The art of ink, reimagined</span>
            </div>

            <h1 className="mt-7 font-sans text-display font-medium text-paper">
              YOUR BODY.
              <br />
              <span className="text-paper-dim">YOUR</span> CANVAS.
            </h1>

            <p className="mt-7 max-w-md text-pretty text-[15px] leading-relaxed text-mist">
              Explore extraordinary tattoo art on a body you can actually turn. Experience every line, every zone and
              every scale in a new dimension — then make it yours.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink
                href="/explore"
                variant="primary"
                size="lg"
                trailing={<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.7} />}
              >
                Explore the gallery
              </ButtonLink>
              <ButtonLink href="/studio" variant="outline" size="lg" icon={<Sparkles className="size-4" strokeWidth={1.6} />}>
                Enter 3D studio
              </ButtonLink>
            </div>

            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-5">
              {[
                { term: 'Designs', value: String(TATTOO_LIBRARY.length).padStart(2, '0') },
                { term: 'Body zones', value: String(regions).padStart(2, '0') },
                { term: 'Characters', value: String(CHARACTERS.length).padStart(2, '0') },
              ].map((stat) => (
                <div key={stat.term}>
                  <dt className="label-caps text-[9px]">{stat.term}</dt>
                  <dd className="mt-1 font-mono text-xl tabular-nums text-paper">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-3 text-mist">
              <ArrowDown className="size-4 animate-bounce" strokeWidth={1.4} />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Scroll to enter the studio</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-mist sm:inline">
                Featured · {hero.name}
              </span>
              <Link
                href={`/tattoos/${hero.slug}`}
                className="group relative size-20 overflow-hidden border border-white/15 sm:size-24"
                aria-label={`View ${hero.name}`}
              >
                <Image src={hero.imageUrl} alt="" fill sizes="96px" className="object-cover opacity-80 transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-0 flex items-center justify-center bg-ink-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowUpRight className="size-4 text-paper" strokeWidth={1.6} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Marquee
        items={[
          'Interactive 3D body',
          'Original artwork',
          '17 mapped zones',
          'Real UV ink application',
          'Studio characters',
          'No account required',
        ]}
      />

      {/* ---------------------------------------------------------- principles */}
      <section className="page-max page-x py-24 md:py-32" aria-labelledby="principles-title">
        <SectionHeading
          index="01"
          eyebrow="The concept"
          title={
            <span id="principles-title">
              A studio, not <span className="font-serif italic text-paper-dim">a catalogue</span>.
            </span>
          }
          description="INKVERSE is a digital tattoo studio. Three things have to be true for that to mean anything: the body has to be real, the ink has to sit on it, and the interface has to stay out of the way."
          action={
            <ButtonLink href="/about" variant="ghost" size="sm" trailing={<ArrowUpRight className="size-3.5" strokeWidth={1.6} />}>
              Our approach
            </ButtonLink>
          }
        />

        <div className="mt-14 grid gap-px overflow-hidden border border-white/8 bg-white/8 md:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.index} className="group relative bg-ink-900 p-7 transition-colors duration-500 hover:bg-ink-850 md:p-9">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.18em] text-acid">{principle.index}</span>
                <principle.icon className="size-5 text-mist transition-colors duration-500 group-hover:text-paper" strokeWidth={1.2} />
              </div>
              <h3 className="mt-8 font-serif text-3xl leading-tight text-paper">{principle.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ featured */}
      <section className="border-y border-white/8 bg-ink-950 py-24 md:py-32" aria-labelledby="featured-title">
        <div className="page-max page-x">
          <SectionHeading
            index="02"
            eyebrow="Selected works"
            title={<span id="featured-title">The vault, opened.</span>}
            description="A working selection from the studio library. Every piece is original vector artwork, drawn for a specific zone of the body."
            action={
              <ButtonLink href="/explore" variant="outline" size="sm" trailing={<ArrowRight className="size-3.5" strokeWidth={1.6} />}>
                All {TATTOO_LIBRARY.length} designs
              </ButtonLink>
            }
          />

          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {featured.map((design, index) => (
              <TattooCard
                key={design.id}
                design={design}
                index={index}
                priority={index < 2}
                variant={index === 0 ? 'feature' : 'grid'}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- studio */}
      <section className="page-max page-x py-24 md:py-32" aria-labelledby="studio-title">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.2em] text-acid">03</span>
              <span className="label-caps text-[10px]">The 3D studio</span>
            </div>
            <h2 id="studio-title" className="mt-5 text-balance font-sans text-editorial font-medium text-paper">
              Turn the body.
              <br />
              <span className="text-paper-dim">Move the ink.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-mist">
              Select a zone by clicking the character or the zone list. Choose a design, then size, rotate and position
              it with immediate feedback. The composition persists while you orbit — undo, compare and export when it is
              right.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                '17 anatomical zones on both characters',
                'Eight independent tattoo layers, 0.02–1.8 m',
                'Undo / redo, compare view, PNG capture',
                'Shareable links that carry the whole composition',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-paper-dim">
                  <span className="mt-1.5 size-1 shrink-0 bg-acid" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/studio" variant="primary" icon={<Sparkles className="size-4" strokeWidth={1.6} />}>
                Enter 3D studio
              </ButtonLink>
              <ButtonLink href="/saved" variant="ghost">
                Resume a composition
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-md text-[11px] leading-relaxed text-mist/80">
              The editor is a visual simulation. A screenshot is a rendering of the 3D viewport — not a photograph of a
              healed tattoo.
            </p>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden border border-white/10">
              <Image
                src="/editorial/studio-chest.webp"
                alt="INKVERSE 3D studio — tattoo applied to the chest and shoulder of a 3D character"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 bg-ink-950/60 px-4 py-2.5 backdrop-blur">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper-dim">Atlas · front</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-acid">03 layers</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink-950/90 to-transparent p-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mist">Chest · lunar moth</p>
                  <p className="font-serif text-2xl text-paper">24 × 24 cm</p>
                </div>
                <Tag tone="acid">ink live</Tag>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-5 -left-6 hidden border border-white/12 bg-ink-900 px-4 py-3 md:block">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mist">Shader placement</p>
              <p className="mt-1 text-xs text-paper-dim">UV-space · follows curvature</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- characters */}
      <section className="border-y border-white/8 bg-ink-950 py-24 md:py-32" aria-labelledby="characters-title">
        <div className="page-max page-x">
          <SectionHeading
            index="04"
            eyebrow="The characters"
            title={<span id="characters-title">Two bodies. One studio.</span>}
            description="Both characters are built from a licensed CC0 anatomical base mesh, morphed into an athletic studio build and mapped with a 17-zone tattoo surface. Nothing here is a mannequin stand-in."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {CHARACTERS.map((character) => (
              <div key={character.id} className="group relative overflow-hidden border border-white/8 bg-ink-900">
                <div className="relative aspect-[3/4]">
                  <Image
                    src={character.thumbnailUrl}
                    alt={`${character.name} — ${character.tagline}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 45vw"
                    className="object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                  <div>
                    <h3 className="font-serif text-4xl leading-none text-paper">{character.name}</h3>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist">{character.tagline}</p>
                    <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-mist/80">{character.meta.skin}</p>
                  </div>
                  <Link
                    href={`/studio?character=${character.id}`}
                    aria-label={`Open ${character.name} in the 3D studio`}
                    className="flex size-11 shrink-0 items-center justify-center border border-white/20 text-paper transition-colors hover:border-acid hover:text-acid"
                  >
                    <ArrowUpRight className="size-4" strokeWidth={1.6} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- styles */}
      <section className="page-max page-x py-24 md:py-32" aria-labelledby="styles-title">
        <SectionHeading
          index="05"
          eyebrow="Disciplines"
          title={<span id="styles-title">Ten ways to wear ink.</span>}
          description="The library is organised by discipline, not by trend. Each category is a real working style with its own logic of line, weight and negative space."
        />
        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-white/8 bg-white/8 sm:grid-cols-3 lg:grid-cols-5">
          {TATTOO_STYLES.map((style, index) => (
            <li key={style} className="bg-ink-900">
              <Link
                href={`/explore?style=${style}`}
                className="group flex h-full flex-col justify-between gap-8 p-5 transition-colors hover:bg-ink-850"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[9px] text-mist">{String(index + 1).padStart(2, '0')}</span>
                  <ArrowUpRight className="size-3.5 text-mist opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.6} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl leading-none text-paper">{STYLE_LABELS[style]}</h3>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
                    {STYLE_COUNTS[style] ?? 0} designs
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- cta */}
      <section className="relative overflow-hidden border-t border-white/8">
        <div className="absolute inset-0">
          <Image src="/editorial/hero-iris.webp" alt="" fill sizes="100vw" className="object-cover object-top opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/60 via-ink-900/85 to-ink-900" />
        </div>
        <div className="page-max page-x relative flex flex-col items-start justify-between gap-10 py-24 md:flex-row md:items-end md:py-32">
          <div className="max-w-2xl">
            <span className="label-caps text-[10px]">Final call</span>
            <h2 className="mt-5 font-sans text-editorial font-medium text-paper">
              Wear it before
              <br />
              you wear it.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-mist">
              Open the studio, pick a body, and spend five minutes with a design before it spends a lifetime on you.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/studio" variant="primary" size="lg">
              Enter 3D studio
            </ButtonLink>
            <ButtonLink href="/explore" variant="outline" size="lg">
              Browse the library
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
