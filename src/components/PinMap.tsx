import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../types';

// No animated pans/zooms: an animation still running when the screen changes makes Leaflet throw (_leaflet_pos).
// Inline SVG pins: Leaflet's default marker images don't resolve under Vite.
const pinIcon = (color: string, size = 34) =>
  L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">
      <path fill="${color}" stroke="white" stroke-width="1.5" d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5s7.5-7.9 7.5-13.5A7.5 7.5 0 0 0 12 1.5z"/>
      <circle cx="12" cy="9" r="2.8" fill="white"/></svg>`,
  });

export const BRAND_PIN = pinIcon('#5E1A47');

/** Round rider badge with a bike glyph, clearly different from the destination pin. */
export const RIDER_PIN = L.divIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#038D63;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
});

function Recenter({ point, zoom }: { point: LatLng; zoom?: number }) {
  const map = useMap();
  // Runs on mount only; the parent remounts this (via `recenterKey`) when it moves the pin programmatically.
  useEffect(() => { map.setView([point.lat, point.lng], zoom ?? map.getZoom(), { animate: false }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Keep every marker in view (e.g. rider + home) whenever any of them moves. */
function FitAll({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 16, animate: false });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export interface PinMapProps {
  value: LatLng;
  onChange?: (p: LatLng) => void; // omit for a read-only map
  recenterKey?: string | number; // change to force the view back onto `value`
  zoom?: number;
  height?: number | string;
  accuracy?: { center: LatLng; radiusM: number }; // e.g. the GeoIndia cell
  extra?: { point: LatLng; icon?: L.DivIcon }[]; // e.g. the rider; the view fits all points
  connect?: boolean; // dashed line from the first extra marker to the pin
}

export function PinMap({ value, onChange, recenterKey, zoom = 16, height = 240, accuracy, extra = [], connect = false }: PinMapProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(() => ({
    dragend: () => {
      const m = markerRef.current;
      if (m) { const ll = m.getLatLng(); onChange?.({ lat: ll.lat, lng: ll.lng }); }
    },
  }), [onChange]);

  return (
    // `isolate` gives the map its own stacking context, so Leaflet's high z-index panes and controls
    // can never sit above the app's sheets, drawers or sticky headers.
    <div className="relative isolate z-0 overflow-hidden rounded-xl" style={{ height }}>
      <MapContainer center={[value.lat, value.lng]} zoom={zoom} scrollWheelZoom className="h-full w-full" attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTilesFailed(true) }} />
        {accuracy && (
          <Circle center={[accuracy.center.lat, accuracy.center.lng]} radius={accuracy.radiusM}
            pathOptions={{ color: '#F59E0B', weight: 1, fillOpacity: 0.08, dashArray: '4 4' }} />
        )}
        {connect && extra[0] && (
          <Polyline positions={[[extra[0].point.lat, extra[0].point.lng], [value.lat, value.lng]]}
            pathOptions={{ color: '#038D63', weight: 3, dashArray: '6 6', opacity: 0.8 }} />
        )}
        {extra.map((e, i) => <Marker key={i} position={[e.point.lat, e.point.lng]} icon={e.icon ?? RIDER_PIN} zIndexOffset={500} />)}
        <Marker position={[value.lat, value.lng]} icon={BRAND_PIN} draggable={!!onChange} eventHandlers={handlers} ref={markerRef} />
        {onChange && <ClickToMove onMove={onChange} />}
        {extra.length > 0 ? <FitAll points={[value, ...extra.map((e) => e.point)]} /> : <Recenter key={recenterKey} point={value} />}
      </MapContainer>
      {tilesFailed && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[400] rounded-md bg-white/90 px-2 py-1 text-center text-[11px] text-ink-muted shadow">
          Map tiles couldn’t load. The pin and DIGIPIN still work.
        </div>
      )}
    </div>
  );
}
