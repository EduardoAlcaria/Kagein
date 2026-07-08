import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeopleSidebar } from './PeopleSidebar';

const people = [
  {
    id: 1,
    name: 'Jane Doe',
    latest: { latitude: 37.33, longitude: -122.0, capturedAt: new Date().toISOString() },
  },
  { id: 2, name: 'No Location', latest: null },
];

describe('PeopleSidebar', () => {
  it('renders each person with a last-seen label', () => {
    render(<PeopleSidebar people={people} selectedPersonId={null} onSelectPerson={vi.fn()} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('no location yet')).toBeInTheDocument();
  });

  it('calls onSelectPerson when a row is clicked', async () => {
    const onSelectPerson = vi.fn();
    const user = userEvent.setup();
    render(<PeopleSidebar people={people} selectedPersonId={null} onSelectPerson={onSelectPerson} />);

    await user.click(screen.getByText('Jane Doe'));

    expect(onSelectPerson).toHaveBeenCalledWith(1);
  });
});
