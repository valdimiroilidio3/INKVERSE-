import { getDesign } from './tattoos';

/** Design lookups with an honest fallback for stale saved data. */
export function designLabel(designId: string): string {
  const design = getDesign(designId);
  return design ? design.name : 'Unavailable design';
}

export function designThumb(designId: string): string | null {
  return getDesign(designId)?.imageUrl ?? null;
}
