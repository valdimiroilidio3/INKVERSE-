import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/studio/StudioWorkspace';

export const metadata: Metadata = {
  title: '3D Studio',
  description:
    'Apply original tattoo designs to a real 3D body. Select a zone, size and rotate the piece, stack up to eight layers and export the result.',
};

export default function StudioPage() {
  return (
    <main id="studio">
      <StudioWorkspace />
    </main>
  );
}
