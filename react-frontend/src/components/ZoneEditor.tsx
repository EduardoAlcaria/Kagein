import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type EditorGeometry =
  | { shape: 'CIRCLE'; center: [number, number]; radiusMeters: number }
  | { shape: 'POLYGON'; vertices: [number, number][] };

export function ZoneEditor({ onGeometry }: { onGeometry: (g: EditorGeometry) => void }) {
  const [mode, setMode] = useState<'CIRCLE' | 'POLYGON'>('CIRCLE');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('');
  const [verticesText, setVerticesText] = useState('');

  function emitCircle() {
    const center: [number, number] = [Number(lat), Number(lon)];
    onGeometry({ shape: 'CIRCLE', center, radiusMeters: Number(radius) });
  }

  function emitPolygon() {
    const vertices = verticesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [vlat, vlon] = line.split(',').map(Number);
        return [vlat, vlon] as [number, number];
      });
    onGeometry({ shape: 'POLYGON', vertices });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant={mode === 'CIRCLE' ? 'default' : 'outline'} onClick={() => setMode('CIRCLE')}>
          Circle
        </Button>
        <Button type="button" variant={mode === 'POLYGON' ? 'default' : 'outline'} onClick={() => setMode('POLYGON')}>
          Polygon
        </Button>
      </div>

      {mode === 'CIRCLE' ? (
        <div className="flex flex-col gap-2">
          <Input aria-label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" />
          <Input aria-label="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude" />
          <Input aria-label="Radius (m)" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="Radius (m)" />
          <Button type="button" onClick={emitCircle}>Use circle</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Vertices (lat,lon per line)"
            value={verticesText}
            onChange={(e) => setVerticesText(e.target.value)}
            className="min-h-24 rounded-md border border-input bg-background p-2 text-sm"
            placeholder={'-23.56,-46.65\n-23.57,-46.64\n-23.58,-46.66'}
          />
          <Button type="button" onClick={emitPolygon}>Use polygon</Button>
        </div>
      )}
    </div>
  );
}
