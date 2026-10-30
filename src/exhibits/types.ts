import type { ComponentType } from 'react';

export type HallId = 'infinity' | 'chaos' | 'harmony' | 'dimensions';

export interface Hall {
  id: HallId;
  numeral: string;
  title: string;
  lead: string;
}

export interface ArtworkProps {
  reducedMotion: boolean;
}

interface ExhibitBase {
  id: string;
  hall: HallId;
  title: string;
  /** Short line shown in lists and on cards. */
  gist: string;
}

export interface OpenExhibit extends ExhibitBase {
  status: 'open';
  author: string;
  year: string;
  /** The rule itself, typeset as a formula on the wall label. */
  rule: string;
  note: string[];
  howTo: string;
  load: () => Promise<{ default: ComponentType<ArtworkProps> }>;
}

export interface UpcomingExhibit extends ExhibitBase {
  status: 'soon';
}

export type Exhibit = OpenExhibit | UpcomingExhibit;
