import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Find My Dashboard' })).toBeInTheDocument();
  });
});
