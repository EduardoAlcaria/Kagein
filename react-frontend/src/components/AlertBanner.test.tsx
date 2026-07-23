import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertBanner } from './AlertBanner';

const alerts = [
  { id: 1, personId: 1, zoneId: null, type: 'STALE_UPDATE', message: 'Jane is stale', triggeredAt: '2026-07-06T12:00:00Z' },
];

describe('AlertBanner', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows a banner for an alert id not yet seen', () => {
    render(<AlertBanner alerts={alerts} />);

    expect(screen.getByText(/Jane is stale/)).toBeInTheDocument();
  });

  it('hides the banner after dismiss and does not show it again for the same id', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AlertBanner alerts={alerts} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    rerender(<AlertBanner alerts={alerts} />);

    expect(screen.queryByText(/Jane is stale/)).not.toBeInTheDocument();
  });

  it('shows the banner again when a genuinely new, higher-id alert arrives after a dismiss', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AlertBanner alerts={alerts} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    const newerAlerts = [
      ...alerts,
      { id: 2, personId: 1, zoneId: null, type: 'STALE_UPDATE', message: 'Jane is stale again', triggeredAt: '2026-07-06T13:00:00Z' },
    ];
    rerender(<AlertBanner alerts={newerAlerts} />);

    expect(screen.getByText(/Jane is stale again/)).toBeInTheDocument();
  });
});
