import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PredictionTotalizers } from './PredictionTotalizers';

const people = [
  { id: 1, name: 'Jane Doe', latest: null },
  { id: 2, name: 'John Smith', latest: null },
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

describe('PredictionTotalizers', () => {
  it('renders one card per person with a mocked percentage', () => {
    render(
      <MemoryRouter>
        <PredictionTotalizers people={people} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getAllByText(/^\d+%$/)).toHaveLength(2);
  });

  it('navigates to the prediction page for the clicked person', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        {/* LocationDisplay lives outside Routes so it stays mounted after navigating
            to a path ("/prediction") that isn't registered in this test's route table. */}
        <LocationDisplay />
        <Routes>
          <Route path="/" element={<PredictionTotalizers people={people} />} />
          <Route path="/prediction" element={null} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Jane Doe'));

    expect(screen.getByTestId('location')).toHaveTextContent('/prediction?personId=1');
  });

  it('renders nothing when there are no people', () => {
    const { container } = render(
      <MemoryRouter>
        <PredictionTotalizers people={[]} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
