// react-frontend/src/components/SelfTrackingToggle.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelfTrackingToggle } from './SelfTrackingToggle';

describe('SelfTrackingToggle', () => {
  it('invokes onToggle with the next state when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<SelfTrackingToggle enabled={false} status="idle" onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Share my location' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('shows a denied hint when enabled but permission is denied', () => {
    render(<SelfTrackingToggle enabled status="denied" onToggle={vi.fn()} />);

    expect(screen.getByText('Location permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop sharing my location' })).toBeInTheDocument();
  });
});
