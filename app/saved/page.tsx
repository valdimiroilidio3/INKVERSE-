import type { Metadata } from 'next';
import { SavedView } from '@/components/saved/SavedView';

export const metadata: Metadata = {
  title: 'Saved designs',
  description: 'Your INKVERSE compositions and favourite tattoo designs, stored locally on this device.',
};

export default function SavedPage() {
  return <SavedView />;
}
