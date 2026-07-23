import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneEditor } from './ZoneEditor';

describe('ZoneEditor', () => {
  it('emits circle geometry from center + radius inputs', async () => {
    const onGeometry = vi.fn();
    const user = userEvent.setup();
    render(<ZoneEditor onGeometry={onGeometry} />);

    await user.type(screen.getByLabelText('Latitude'), '-23.56');
    await user.type(screen.getByLabelText('Longitude'), '-46.65');
    await user.type(screen.getByLabelText('Radius (m)'), '50');
    await user.click(screen.getByRole('button', { name: 'Use circle' }));

    expect(onGeometry).toHaveBeenCalledWith({
      shape: 'CIRCLE',
      center: [-23.56, -46.65],
      radiusMeters: 50,
    });
  });

  it('emits polygon geometry from pasted vertices', async () => {
    const onGeometry = vi.fn();
    const user = userEvent.setup();
    render(<ZoneEditor onGeometry={onGeometry} />);

    await user.click(screen.getByRole('button', { name: 'Polygon' }));
    await user.type(screen.getByLabelText('Vertices (lat,lon per line)'), '0,0{Enter}0,2{Enter}2,2');
    await user.click(screen.getByRole('button', { name: 'Use polygon' }));

    expect(onGeometry).toHaveBeenCalledWith({
      shape: 'POLYGON',
      vertices: [[0, 0], [0, 2], [2, 2]],
    });
  });
});
