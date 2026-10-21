import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { StudioClock } from './StudioClock';

const links = [
  {
    title: 'Experience',
    items: [
      { label: 'Explore the gallery', href: '/explore' },
      { label: '3D Studio', href: '/studio' },
      { label: 'Saved designs', href: '/saved' },
    ],
  },
  {
    title: 'Studio',
    items: [
      { label: 'About INKVERSE', href: '/about' },
      { label: 'Licensing & assets', href: '/about#assets' },
      { label: 'Known limitations', href: '/about#limitations' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-ink-950">
      <div className="page-max page-x py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-[15px] font-semibold uppercase tracking-[0.34em] text-paper">INKVERSE</span>
              <span className="font-serif text-[11px] text-acid">®</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-mist">
              A digital tattoo studio. Original artwork, a real 3D body, and a try-on that respects the anatomy it is
              drawn on.
            </p>
            <div className="mt-6 flex items-center gap-3 text-[11px] text-mist">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-acid" />
              </span>
              <StudioClock />
            </div>
          </div>

          {links.map((group) => (
            <div key={group.title}>
              <h2 className="label-caps text-[10px] text-mist/70">{group.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-1 text-sm text-paper-dim transition-colors hover:text-paper"
                    >
                      {item.label}
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.6} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="label-caps text-[10px] text-mist/70">Studio</h2>
            <address className="mt-4 not-italic text-sm leading-relaxed text-paper-dim">
              Coimbra, Portugal
              <br />
              By appointment only
            </address>
            <p className="mt-4 text-[11px] leading-relaxed text-mist/70">
              A design concept. The studio, artists and commissions are fictional.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/8 pt-6 text-[11px] text-mist sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} INKVERSE®. All artwork original to this project.</p>
          <p className="max-w-md leading-relaxed">
            The 3D editor is a visual simulation. Screenshots are renderings, not photographs of a real tattoo.
          </p>
        </div>
      </div>
    </footer>
  );
}
