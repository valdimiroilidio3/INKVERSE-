import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight, Check, Minus } from 'lucide-react';
import { SectionHeading } from '@/components/site/SectionHeading';
import { ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { TATTOO_LIBRARY } from '@/lib/tattoos';
import { ARTISTS } from '@/lib/tattoos';
import { CHARACTERS } from '@/lib/characters';

export const metadata: Metadata = {
  title: 'About the studio',
  description:
    'How INKVERSE is built: the licensed 3D anatomy, the procedurally painted skin, the UV-space ink engine, and the limitations we are not going to hide.',
};

const STACK = [
  ['Framework', 'Next.js 15 · App Router · React 19 · TypeScript (strict)'],
  ['3D', 'three.js · React Three Fiber · drei · glTF (GLB) · custom skin shader'],
  ['Styling', 'Tailwind CSS v4 design tokens · Geist · Instrument Serif'],
  ['State', 'Zustand (studio + library) with schema-validated persistence'],
  ['Validation', 'Zod at every boundary: storage, share links, saved data'],
  ['Testing', 'Vitest · Testing Library (unit + interaction)'],
] as const;

const LIMITS = [
  'The studio characters are an athletic male and an athletic female build, both 1.86 m. There is no body-type or skin-tone selector yet.',
  'Placement is a square plate inside a mapped UV island. It follows curvature perfectly but cannot wrap a design around the full circumference of an arm or leg.',
  'Zones on the hands, feet, face and fingers are deliberately excluded — the surface is too small for a faithful square placement.',
  'The ink preview does not simulate healing, ageing, blowout, stretch or the artist’s hand. It is a placement and scale tool, not a medical or artistic guarantee.',
  'Saved compositions and favourites are stored in this browser only. There is no account system, so nothing syncs between devices.',
  'Share links are self-contained and can be long. Links beyond 1600 characters are rejected rather than silently truncated.',
];

export default function AboutPage() {
  return (
    <main className="pt-[var(--header-h)]">
      <section className="page-max page-x pt-14 md:pt-20">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-acid" />
          <span className="label-caps text-[10px]">The studio</span>
        </div>
        <h1 className="mt-6 max-w-3xl font-sans text-display font-medium text-paper">
          Built like a
          <br />
          <span className="font-serif italic text-paper-dim">tattoo,</span> not a demo.
        </h1>
        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-mist">
          INKVERSE is a product exercise with a strict rule: nothing on screen may promise more than it can deliver.
          The body is real geometry, the ink is applied where the skin is, and every limitation is written down.
        </p>
        <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-white/10 pt-6 md:grid-cols-4">
          {[
            ['Designs', TATTOO_LIBRARY.length],
            ['Artists', ARTISTS.length],
            ['Characters', CHARACTERS.length],
            ['Mapped zones', 17],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="label-caps text-[9px]">{label}</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-paper">{String(value).padStart(2, '0')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="page-max page-x py-20">
        <SectionHeading
          index="01"
          eyebrow="Anatomy"
          title="A body you can inspect."
          description="Both characters start from the MakeHuman CC0 base mesh — a 13,380-vertex anatomical body with a clean, non-overlapping UV layout. We morph it into a studio build, normalise it to 1.86 m, and bake skin detail from the topology itself."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Geometry', body: '14,517 vertices · 26,756 triangles per character. Exported to GLB with tangents, normals and a single UV set.' },
            { title: 'Skin', body: 'Procedural PBR albedo baked at 2048²: tonal variation, flush, brows, lash line, stubble, scalp and baked AO from real vertex occlusion.' },
            { title: 'Zones', body: 'Nearest-bone segmentation of the mesh into 17 regions, baked as a per-texel region ID texture used for hit-testing, masking and highlighting.' },
          ].map((item) => (
            <div key={item.title} className="border border-white/8 bg-ink-850 p-6">
              <h3 className="font-serif text-2xl text-paper">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {CHARACTERS.map((character) => (
            <div key={character.id} className="relative aspect-[16/10] overflow-hidden border border-white/8">
              <Image src={character.thumbnailUrl} alt={character.name} fill sizes="50vw" className="object-cover object-top opacity-90" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 to-transparent p-4">
                <p className="font-serif text-2xl text-paper">{character.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">{character.meta.source}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/8 bg-ink-950 py-20" id="assets">
        <div className="page-max page-x">
          <SectionHeading
            index="02"
            eyebrow="Assets & licensing"
            title="Everything is accounted for."
            description="No unlicensed model, texture or artwork is shipped with this project. This is the complete inventory."
          />
          <div className="mt-10 overflow-hidden border border-white/8">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-ink-900">
                  <th className="p-4 font-mono text-[9px] uppercase tracking-[0.16em] text-mist">Asset</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-[0.16em] text-mist">Source</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-[0.16em] text-mist">Licence</th>
                </tr>
              </thead>
              <tbody className="text-paper-dim">
                <tr className="border-b border-white/8">
                  <td className="p-4">Base human mesh + joint anchors</td>
                  <td className="p-4">makehumancommunity/makehuman (base.obj)</td>
                  <td className="p-4"><Tag tone="acid">CC0 1.0</Tag></td>
                </tr>
                <tr className="border-b border-white/8">
                  <td className="p-4">Character morphs, skin textures, clothing mask</td>
                  <td className="p-4">Baked procedurally in this repo (tools/assets)</td>
                  <td className="p-4"><Tag tone="acid">Original</Tag></td>
                </tr>
                <tr className="border-b border-white/8">
                  <td className="p-4">{TATTOO_LIBRARY.length} tattoo designs</td>
                  <td className="p-4">Original vector artwork authored for INKVERSE (assets/tattoos-src)</td>
                  <td className="p-4"><Tag tone="acid">Original</Tag></td>
                </tr>
                <tr className="border-b border-white/8">
                  <td className="p-4">Editorial renders</td>
                  <td className="p-4">Rendered offline from the same GLB + placement maths (tools/assets/render_editorial.py)</td>
                  <td className="p-4"><Tag tone="acid">Original</Tag></td>
                </tr>
                <tr>
                  <td className="p-4">Typefaces</td>
                  <td className="p-4">Geist (Vercel) · Instrument Serif (Google Fonts)</td>
                  <td className="p-4"><Tag tone="acid">OFL 1.1</Tag></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-mist/80">
            Tattoo artwork in this project is original but is not licensed for reproduction as a real tattoo. Bring a
            design to a licensed artist rather than tracing it.
          </p>
        </div>
      </section>

      <section className="page-max page-x py-20">
        <SectionHeading index="03" eyebrow="Under the hood" title="The ink engine." description="A short technical account of how a design gets onto skin — and stays there while you orbit." />
        <ol className="mt-10 grid gap-px overflow-hidden border border-white/8 bg-white/8 md:grid-cols-2">
          {[
            ['01', 'UV islands', 'The mesh is segmented into connected UV islands. Each of the 17 body regions owns one or more islands with a measured metres-per-UV-unit scale.'],
            ['02', 'Physical placement', 'A design is a square plate sized in metres. Its UV half-extents are derived from the region’s measured stretch, so the piece is physically square on skin.'],
            ['03', 'Ink atlas', 'Up to eight designs are rasterised into 16 tiles of a 2048² density atlas at runtime. Density comes from artwork luminance, so paper-coloured negative space stays skin.'],
            ['04', 'Skin shader', 'The skin material samples the atlas in each pixel’s tattoo-local space, gated by the region ID texture, then multiplies the ink into the albedo beneath the specular layer.'],
          ].map(([index, title, body]) => (
            <li key={index} className="bg-ink-900 p-6">
              <span className="font-mono text-[10px] tracking-[0.18em] text-acid">{index}</span>
              <h3 className="mt-4 font-serif text-2xl text-paper">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="border border-white/8 bg-ink-850 p-6">
            <h3 className="label-caps text-[10px] text-mist">Stack</h3>
            <dl className="mt-4 space-y-3">
              {STACK.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[92px_1fr] gap-3">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">{key}</dt>
                  <dd className="text-xs leading-relaxed text-paper-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border border-white/8 bg-ink-850 p-6">
            <h3 className="label-caps text-[10px] text-mist">Performance budget</h3>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-paper-dim">
              {[
                'Model: 619 KB per character (GLB, Draco-ready pipeline)',
                'Skin: 110–122 KB albedo, 503 KB shared normal map',
                'Renderer: DPR capped at 1.9, shadows 1024², contact shadows 512²',
                '3D code is client-only and dynamically imported; the gallery ships no WebGL',
                'prefers-reduced-motion disables the hero orbit and page motion',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-acid" strokeWidth={2} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-ink-950 py-20" id="limitations">
        <div className="page-max page-x">
          <SectionHeading
            index="04"
            eyebrow="Known limitations"
            title="What this is not."
            description="Every product has a boundary. These are ours, stated up front so nobody discovers them the hard way."
          />
          <ul className="mt-10 space-y-px bg-white/8">
            {LIMITS.map((limit) => (
              <li key={limit} className="flex items-start gap-3 bg-ink-900 p-5 text-sm leading-relaxed text-paper-dim">
                <Minus className="mt-0.5 size-4 shrink-0 text-blood" strokeWidth={2} />
                {limit}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/studio" variant="primary" trailing={<ArrowUpRight className="size-4" strokeWidth={1.6} />}>
              Open the studio
            </ButtonLink>
            <ButtonLink href="/explore" variant="outline">
              Browse designs
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
