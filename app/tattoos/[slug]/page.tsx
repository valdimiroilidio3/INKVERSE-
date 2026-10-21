import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { TattooCard } from '@/components/gallery/TattooCard';
import { FavoriteButton } from '@/components/gallery/FavoriteButton';
import { TATTOO_LIBRARY, getDesignBySlug } from '@/lib/tattoos';
import { REGION_LABELS } from '@/lib/regions';
import { STYLE_LABELS } from '@/lib/types';

export function generateStaticParams() {
  return TATTOO_LIBRARY.map((design) => ({ slug: design.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const design = getDesignBySlug(slug);
  if (!design) return { title: 'Design not found' };
  return {
    title: design.name,
    description: `${design.name} — ${STYLE_LABELS[design.style]} by ${design.artist}. ${design.description}`,
    openGraph: {
      images: [{ url: design.imageUrl, width: 640, height: 640, alt: design.name }],
      title: `${design.name} · INKVERSE®`,
      description: design.description,
    },
  };
}

export default async function TattooDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = getDesignBySlug(slug);
  if (!design) notFound();

  const related = TATTOO_LIBRARY.filter((d) => d.id !== design.id && d.style === design.style).slice(0, 3);
  const fallbackRelated = TATTOO_LIBRARY.filter((d) => d.id !== design.id).slice(0, 3);
  const suggestions = related.length >= 2 ? related : fallbackRelated;

  return (
    <main className="pt-[var(--header-h)]">
      <div className="page-max page-x pt-8">
        <Link href="/explore" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist transition-colors hover:text-paper">
          <ArrowLeft className="size-3.5" strokeWidth={1.6} /> Back to the library
        </Link>
      </div>

      <article className="page-max page-x grid gap-10 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-14">
        <div>
          <div className="relative aspect-square overflow-hidden border border-white/10 bg-ink-850">
            <Image
              src={design.imageUrl}
              alt={`${design.name} — ${STYLE_LABELS[design.style]} tattoo design by ${design.artist}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute left-4 top-4 flex gap-2">
              <Tag tone="acid">{STYLE_LABELS[design.style]}</Tag>
              <Tag tone="dark">{design.year}</Tag>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <figure className="relative aspect-square overflow-hidden border border-white/8">
              <Image src="/editorial/detail-chest.webp" alt="The design previewed on a 3D chest" fill sizes="30vw" className="object-cover opacity-90" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-ink-950/70 px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-mist backdrop-blur">
                Chest · 3D preview
              </figcaption>
            </figure>
            <figure className="relative aspect-square overflow-hidden border border-white/8">
              <Image src="/editorial/detail-arm.webp" alt="The design previewed on a 3D arm" fill sizes="30vw" className="object-cover opacity-90" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-ink-950/70 px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-mist backdrop-blur">
                Arm · 3D preview
              </figcaption>
            </figure>
          </div>
        </div>

        <div className="flex flex-col">
          <p className="label-caps text-[10px]">Design {design.id}</p>
          <h1 className="mt-4 font-sans text-[clamp(2.4rem,5vw,4rem)] font-medium leading-[0.96] tracking-[-0.03em] text-paper">
            {design.name}
          </h1>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
            {design.artist} · {STYLE_LABELS[design.style]}
          </p>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-paper-dim">{design.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-white/8 bg-white/8">
            <div className="bg-ink-900 p-4">
              <dt className="label-caps text-[9px]">Default size</dt>
              <dd className="mt-1 text-sm text-paper">{Math.round(design.defaultSize * 100)} × {Math.round(design.defaultSize * 100)} cm</dd>
            </div>
            <div className="bg-ink-900 p-4">
              <dt className="label-caps text-[9px]">Artist</dt>
              <dd className="mt-1 text-sm text-paper">{design.artist}</dd>
            </div>
            <div className="col-span-2 bg-ink-900 p-4">
              <dt className="label-caps text-[9px]">Recommended zones</dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {design.recommendedRegions.map((region) => (
                  <Tag key={region}>{REGION_LABELS[region] ?? region}</Tag>
                ))}
              </dd>
            </div>
            <div className="col-span-2 bg-ink-900 p-4">
              <dt className="label-caps text-[9px]">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mist">
                {design.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={`/studio?design=${design.id}`}
              variant="primary"
              size="lg"
              icon={<Sparkles className="size-4" strokeWidth={1.6} />}
            >
              Try in 3D studio
            </ButtonLink>
            <FavoriteButton designId={design.id} name={design.name} />
          </div>

          <p className="mt-8 border-t border-white/8 pt-5 text-[11px] leading-relaxed text-mist/80">
            {design.licensing} The 3D preview is a visual simulation of placement and scale — it is not a guarantee of
            how the finished tattoo will look after healing.
          </p>

          <div className="mt-8">
            <h2 className="label-caps text-[10px]">More in {STYLE_LABELS[design.style]}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <Link
                  key={item.id}
                  href={`/tattoos/${item.slug}`}
                  className="group inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-paper-dim transition-colors hover:border-white/30 hover:text-paper"
                >
                  {item.name}
                  <ArrowUpRight className="size-3 text-mist transition-colors group-hover:text-acid" strokeWidth={1.6} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>

      <section className="border-t border-white/8 bg-ink-950 py-16">
        <div className="page-max page-x">
          <h2 className="font-serif text-3xl text-paper">Keep looking</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {suggestions.map((item, index) => (
              <TattooCard key={item.id} design={item} index={index} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
