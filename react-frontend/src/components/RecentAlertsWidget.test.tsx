import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentAlertsWidget } from './RecentAlertsWidget';

describe('RecentAlertsWidget', () => {
  it('shows at most 5 alerts and a link to the full list', () => {
    const alerts = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      personId: 1,
      type: 'STALE_UPDATE',
      message: `Alert ${i + 1}`,
      triggeredAt: '2026-07-06T12:00:00Z',
    }));

    render(
      <MemoryRouter>
        <RecentAlertsWidget alerts={alerts} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Alert 1')).toBeInTheDocument();
    expect(screen.getByText('Alert 5')).toBeInTheDocument();
    expect(screen.queryByText('Alert 6')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/alerts');
  });

  it('shows an empty state with no alerts', () => {
    render(
      <MemoryRouter>
        <RecentAlertsWidget alerts={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No alerts yet.')).toBeInTheDocument();
  });
});
