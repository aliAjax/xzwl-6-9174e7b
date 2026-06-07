export interface Box {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
}

export interface CollectionBatch {
  id: string;
  name: string;
  collectionDate: string;
  location: string;
  participants: string;
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
  batchId: string;
  photographed: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Filters {
  search: string;
  onlyUnphotographed: boolean;
  boxId: string;
  batchId: string;
}

export type SpecimenFormData = Omit<Specimen, 'id' | 'createdAt' | 'updatedAt'>;

export type BoxFormData = Omit<Box, 'id' | 'createdAt'>;

export type CollectionBatchFormData = Omit<CollectionBatch, 'id' | 'createdAt'>;
