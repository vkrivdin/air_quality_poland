"use client";

/**
 * KrakowMap
 * Small Leaflet-based map showing Kraków stations from Supabase.
 * This is an MVP preview; the full Poland map will use a shared component later.
 */
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type KrakowMapProps = {
  stations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
};

const defaultCenter: [number, number] = [50.0614, 19.9366];

const stationIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function KrakowMap({ stations }: KrakowMapProps) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={stationIcon}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{station.name}</p>
                <p className="text-slate-500">Kraków</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

