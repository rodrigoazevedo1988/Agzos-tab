// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultList } from '@renderer/components/ResultList';
import { usePaletteStore } from '@renderer/stores/palette-store';

import type { SearchGroup } from '@shared/types/search';

const groups: SearchGroup[] = [
  {
    category: 'system',
    label: 'System',
    items: [
      {
        id: 'system.open-calculator',
        kind: 'command',
        title: 'Open Calculator',
        subtitle: 'Launch the system calculator',
        category: 'system',
        icon: 'Calculator',
        score: 100,
        source: 'system',
        riskLevel: 'safe',
        isFavorite: false,
      },
      {
        id: 'history.clear',
        kind: 'command',
        title: 'Clear History',
        subtitle: 'Delete all recorded recent items',
        category: 'system',
        icon: 'Trash2',
        score: 50,
        source: 'builtin',
        riskLevel: 'destructive',
        requiresConfirmation: true,
        isFavorite: true,
      },
    ],
  },
];

beforeEach(() => {
  usePaletteStore.setState({ selectedIndex: 0 });
});

afterEach(() => {
  cleanup();
});

describe('ResultList', () => {
  it('renders one option per result with group headers', () => {
    render(
      <ResultList
        groups={groups}
        flat={groups.flatMap((group) => group.items)}
        onRun={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('Open Calculator')).toBeInTheDocument();
  });

  it('marks the selected item with aria-selected', () => {
    render(
      <ResultList
        groups={groups}
        flat={groups.flatMap((group) => group.items)}
        onRun={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('shows a confirmation badge for destructive commands', () => {
    render(
      <ResultList
        groups={groups}
        flat={groups.flatMap((group) => group.items)}
        onRun={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('invokes onRun when a result is clicked', () => {
    const onRun = vi.fn();
    render(
      <ResultList
        groups={groups}
        flat={groups.flatMap((group) => group.items)}
        onRun={onRun}
        onHover={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Open Calculator'));
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'system.open-calculator' }));
  });

  it('renders an empty state when there are no results', () => {
    render(<ResultList groups={[]} flat={[]} onRun={vi.fn()} onHover={vi.fn()} />);
    expect(screen.getByText(/No results/)).toBeInTheDocument();
  });
});
