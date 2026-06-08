/** @vitest-environment jsdom */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotographySessions } from './usePhotographySessions';
import type {
  Box,
  CollectionBatch,
  PhotographySessionTarget,
  Specimen,
} from '../types';
import * as helpers from '../utils/helpers';

type HookResult = ReturnType<typeof usePhotographySessions>;

const createMockBox = (overrides: Partial<Box> = {}): Box => ({
  id: 'box-1',
  name: 'Box 1',
  location: 'Shelf A',
  notes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockBatch = (overrides: Partial<CollectionBatch> = {}): CollectionBatch => ({
  id: 'batch-1',
  name: 'Batch 2024',
  collectionDate: '2024-01-01',
  location: 'Forest',
  participants: 'John Doe',
  notes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockSpecimen = (overrides: Partial<Specimen> = {}): Specimen => ({
  id: 'specimen-1',
  specimenNo: 'SP-001',
  species: 'Test Species',
  collectionLocation: 'Test Location',
  collectionDate: '2024-01-01',
  pinnedStatus: false,
  boxId: '',
  batchId: '',
  photographed: false,
  notes: '',
  complianceStatus: 'not_relevant',
  permitNumber: '',
  permitExpiryDate: '',
  complianceNotes: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const renderPhotographyHook = (
  specimens: Specimen[],
  boxes: Box[] = [],
  batches: CollectionBatch[] = [],
  markPhotographed = vi.fn()
) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let result: HookResult | undefined;

  const TestHarness = () => {
    result = usePhotographySessions(specimens, boxes, batches, markPhotographed);
    return null;
  };

  act(() => {
    root.render(<TestHarness />);
  });

  return {
    get result() {
      if (!result) {
        throw new Error('Hook did not render');
      }
      return result;
    },
    rerender(nextSpecimens: Specimen[]) {
      act(() => {
        root.render(
          <HookHarness
            specimens={nextSpecimens}
            boxes={boxes}
            batches={batches}
            markPhotographed={markPhotographed}
            onResult={(nextResult) => {
              result = nextResult;
            }}
          />
        );
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

function HookHarness({
  specimens,
  boxes,
  batches,
  markPhotographed,
  onResult,
}: {
  specimens: Specimen[];
  boxes: Box[];
  batches: CollectionBatch[];
  markPhotographed: (ids: string[], photographed?: boolean) => void;
  onResult: (result: HookResult) => void;
}) {
  const result = usePhotographySessions(specimens, boxes, batches, markPhotographed);
  onResult(result);
  return null;
}

describe('usePhotographySessions', () => {
  const boxes = [
    createMockBox({ id: 'box-1', name: 'Pinned Box' }),
    createMockBox({ id: 'box-2', name: 'Archive Box' }),
  ];
  const batches = [
    createMockBatch({ id: 'batch-1', name: 'Spring Batch' }),
    createMockBatch({ id: 'batch-2', name: 'Summer Batch' }),
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create sessions from targets and skip already photographed specimens', () => {
    const specimens = [
      createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001', boxId: 'box-1' }),
      createMockSpecimen({ id: 'sp-2', specimenNo: 'SP-002', boxId: 'box-1', photographed: true }),
      createMockSpecimen({ id: 'sp-3', specimenNo: 'SP-003', batchId: 'batch-2' }),
      createMockSpecimen({ id: 'sp-4', specimenNo: 'SP-004', complianceStatus: 'protected_species' }),
    ];
    const hook = renderPhotographyHook(specimens, boxes, batches);

    const targets: PhotographySessionTarget[] = [
      { type: 'box', id: 'box-1', name: 'Pinned Box' },
      { type: 'highRisk', id: '__high_risk__', name: '合规高风险' },
    ];

    expect(hook.result.getSpecimensForTargets(targets).map((s) => s.id)).toEqual(['sp-1', 'sp-4']);

    let createdSession: ReturnType<HookResult['createSession']>;
    act(() => {
      createdSession = hook.result.createSession({
        name: 'High risk shoot',
        priority: 'high',
        notes: 'urgent',
        scheduledDate: '2024-06-01',
        targets,
      });
    });

    expect(createdSession!.specimenIds).toEqual(['sp-1', 'sp-4']);
    expect(hook.result.sessions).toHaveLength(1);
    expect(hook.result.activeSessions).toHaveLength(1);
    expect(hook.result.getSessionProgress(createdSession!.id)).toEqual({
      total: 2,
      completed: 0,
      percentage: 0,
    });

    hook.unmount();
  });

  it('should update progress and complete sessions when all target specimens are photographed', () => {
    const sessionSpecimens = [
      createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001', boxId: 'box-1' }),
      createMockSpecimen({ id: 'sp-2', specimenNo: 'SP-002', boxId: 'box-1' }),
    ];
    const hook = renderPhotographyHook(sessionSpecimens, boxes, batches);

    let sessionId = '';
    act(() => {
      const created = hook.result.createSession({
        name: 'Box shoot',
        priority: 'medium',
        notes: '',
        scheduledDate: '2024-06-01',
        targets: [{ type: 'box', id: 'box-1', name: 'Pinned Box' }],
      });
      sessionId = created.id;
    });

    const completedSpecimens = sessionSpecimens.map((specimen) => ({
      ...specimen,
      photographed: true,
    }));
    hook.rerender(completedSpecimens);

    act(() => {
      hook.result.updateSessionProgress(sessionId);
    });

    expect(hook.result.getSessionProgress(sessionId)).toEqual({
      total: 2,
      completed: 2,
      percentage: 100,
    });
    expect(hook.result.completedSessions).toHaveLength(1);
    expect(hook.result.completedSessions[0].completedAt).toBeDefined();

    hook.unmount();
  });

  it('should mark remaining specimens photographed when completing a session', () => {
    const markPhotographed = vi.fn();
    const specimens = [
      createMockSpecimen({ id: 'sp-1', specimenNo: 'SP-001', batchId: 'batch-1' }),
      createMockSpecimen({ id: 'sp-2', specimenNo: 'SP-002', batchId: 'batch-1', photographed: true }),
    ];
    const hook = renderPhotographyHook(specimens, boxes, batches, markPhotographed);

    let sessionId = '';
    act(() => {
      sessionId = hook.result.createSession({
        name: 'Batch shoot',
        priority: 'low',
        notes: '',
        scheduledDate: '2024-06-01',
        targets: [{ type: 'batch', id: 'batch-1', name: 'Spring Batch' }],
      }).id;
    });

    act(() => {
      hook.result.completeSession(sessionId);
    });

    expect(markPhotographed).toHaveBeenCalledWith(['sp-1'], true);
    expect(hook.result.completedSessions).toHaveLength(1);
    expect(hook.result.getSessionProgress(sessionId)).toEqual({
      total: 1,
      completed: 1,
      percentage: 100,
    });

    hook.unmount();
  });

  it('should export a photography checklist CSV with box and batch labels', () => {
    const downloadSpy = vi.spyOn(helpers, 'downloadCsv').mockImplementation(() => {});
    const specimens = [
      createMockSpecimen({
        id: 'sp-1',
        specimenNo: 'SP-001',
        species: 'Papilio',
        boxId: 'box-1',
        batchId: 'batch-1',
        notes: 'needs side view',
        complianceStatus: 'protected_species',
      }),
    ];
    const hook = renderPhotographyHook(specimens, boxes, batches);

    let sessionId = '';
    act(() => {
      sessionId = hook.result.createSession({
        name: 'Checklist',
        priority: 'high',
        notes: '',
        scheduledDate: '2024-06-01',
        targets: [{ type: 'box', id: 'box-1', name: 'Pinned Box' }],
      }).id;
    });

    act(() => {
      hook.result.exportSessionChecklist(sessionId);
    });

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [csvContent, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/^拍摄清单_Checklist_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csvContent).toContain('标本编号,物种名,展盒,批次,合规风险,备注,拍照状态');
    expect(csvContent).toContain('SP-001,Papilio,Pinned Box,Spring Batch,保护物种,needs side view,未拍照');

    hook.unmount();
  });
});
