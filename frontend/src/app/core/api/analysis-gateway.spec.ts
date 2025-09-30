import { resolveSuggestedLabelIds, resolveSuggestedStatusId } from './analysis-gateway';
import { Label, Status } from '@core/models';

describe('AnalysisGateway suggestion helpers', () => {
  const statuses: Status[] = [
    { id: 'status-todo', name: 'To Do', category: 'todo', order: 1, color: '#111827' },
    { id: 'status-doing', name: 'Doing', category: 'in-progress', order: 2, color: '#2563eb' },
    { id: 'status-done', name: 'Done', category: 'done', order: 3, color: '#16a34a' },
  ];

  const labels: Label[] = [
    { id: 'label-ai', name: 'AI', color: '#6366f1' },
    { id: 'label-ops', name: 'Operations', color: '#f97316' },
    { id: 'label-cx', name: 'Customer Success', color: '#10b981' },
  ];

  describe('resolveSuggestedStatusId', () => {
    it('matches direct identifiers regardless of casing', () => {
      expect(resolveSuggestedStatusId('STATUS-TODO', statuses, 'status-todo')).toBe('status-todo');
    });

    it('matches localized names with additional annotations', () => {
      expect(resolveSuggestedStatusId('進行中 (id: status-doing)', statuses, 'status-todo')).toBe(
        'status-doing',
      );
    });

    it('uses status categories and aliases to map common variants', () => {
      expect(resolveSuggestedStatusId('In Progress', statuses, 'status-todo')).toBe('status-doing');
      expect(resolveSuggestedStatusId('backlog', statuses, 'status-done')).toBe('status-todo');
      expect(resolveSuggestedStatusId('completed', statuses, 'status-doing')).toBe('status-done');
    });

    it('falls back to the default status when no match is found', () => {
      expect(resolveSuggestedStatusId('unknown', statuses, 'status-doing')).toBe('status-doing');
    });
  });

  describe('resolveSuggestedLabelIds', () => {
    it('matches labels by identifier and name', () => {
      expect(resolveSuggestedLabelIds(['label-ai', 'operations'], labels)).toEqual([
        'label-ai',
        'label-ops',
      ]);
    });

    it('extracts label identifiers from annotated values and keeps order', () => {
      expect(resolveSuggestedLabelIds(['AI (id: label-ai)', 'Customer Success'], labels)).toEqual([
        'label-ai',
        'label-cx',
      ]);
    });

    it('deduplicates results while preserving the first occurrence', () => {
      expect(resolveSuggestedLabelIds(['AI', 'ai', 'LABEL-AI'], labels)).toEqual(['label-ai']);
    });

    it('ignores unknown labels', () => {
      expect(resolveSuggestedLabelIds(['Marketing'], labels)).toEqual([]);
    });
  });
});
