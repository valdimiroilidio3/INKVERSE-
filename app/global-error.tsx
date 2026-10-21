'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          background: '#080808',
          color: '#f5f5f2',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b8452f' }}>
            INKVERSE · fatal
          </p>
          <h1 style={{ margin: '1rem 0 0', fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', lineHeight: 1.05 }}>
            The studio could not start.
          </h1>
          <p style={{ marginTop: '1rem', color: '#929292', lineHeight: 1.6, fontSize: 14 }}>
            Reload the page. If it keeps failing, your browser may not support WebGL 2, which the 3D studio needs.
          </p>
          <p style={{ marginTop: '0.5rem', color: '#3a3a3a', fontSize: 12 }}>{error?.digest ?? ''}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.75rem',
              height: 44,
              padding: '0 20px',
              border: '1px solid #d6ff52',
              background: '#d6ff52',
              color: '#080808',
              font: 'inherit',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Reload studio
          </button>
        </div>
      </body>
    </html>
  );
}
