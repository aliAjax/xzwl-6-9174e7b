export interface Box {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
}

export interface Specimen {
  id: string;
  specimenNo: string;
  species: string;
  collectionLocation: string;
  collectionDate: string;
  pinnedStatus: boolean;
  boxId: string;
  photographed: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Filters {
  search: string;
  onlyUnphotographed: boolean;
  boxId: string;
}

export type SpecimenFormData = Omit<Specimen, 'id' | 'createdAt' | 'updatedAt'>;

export type BoxFormData = Omit<Box, 'id' | 'createdAt'>;
