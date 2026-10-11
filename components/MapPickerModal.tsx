import React, { useRef, useEffect, useState } from 'react';
import { MapPin, X, Search, Crosshair, Check, Loader2 } from 'lucide-react';
import { Button } from './Button';

declare var L: any;

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLat = -6.2088,
  initialLng = 106.8456,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [currentLat, setCurrentLat] = useState<number>(initialLat);
  const [currentLng, setCurrentLng] = useState<number>(initialLng);
  const [addressPreview, setAddressPreview] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchAddress = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setAddressPreview(data.display_name || data.full_display_name || '');
      }
    } catch (e) {
      console.warn('Could not reverse geocode', e);
    } finally {
      setIsGeocoding(false);
    }
  };

  const updateMarkerPosition = (lat: number, lng: number, updateView = false) => {
    setCurrentLat(lat);
    setCurrentLng(lng);

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else if (mapInstanceRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', (event: any) => {
        const pos = event.target.getLatLng();
        updateMarkerPosition(pos.lat, pos.lng);
      });
    }

    if (updateView && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 15);
    }

    fetchAddress(lat, lng);
  };

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([currentLat, currentLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', (event: any) => {
        const pos = event.target.getLatLng();
        updateMarkerPosition(pos.lat, pos.lng);
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        updateMarkerPosition(lat, lng);
      });

      mapInstanceRef.current = map;
      fetchAddress(currentLat, currentLng);
    } else {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isOpen]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          updateMarkerPosition(latitude, longitude, true);
        },
        (err) => {
          console.warn('Geolocation denied or failed', err);
          alert('Akses lokasi GPS ditolak atau tidak tersedia. Silakan cari atau pilih titik di peta.');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.warn('Search geocode failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      updateMarkerPosition(lat, lng, true);
      setAddressPreview(result.display_name);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const handleConfirm = () => {
    onSelect(currentLat, currentLng, addressPreview);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-3xl h-[620px] flex flex-col shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pilih Titik Lokasi Peta</h3>
              <p className="text-xs text-slate-400">
                Klik pada peta atau geser pin marker untuk menentukan koordinat akurat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & GPS Bar */}
        <div className="p-3 bg-slate-850 border-b border-slate-800 flex gap-2 relative z-20">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cari nama jalan, gedung, kecamatan, kota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" isLoading={isSearching}>
              Cari
            </Button>
          </form>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGetCurrentLocation}
            icon={<Crosshair size={16} />}
            title="Dapatkan koordinat GPS perangkat saya"
          >
            GPS Saya
          </Button>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-3 hover:bg-slate-700/70 border-b border-slate-700/50 last:border-0 transition-colors flex items-start gap-2"
                >
                  <MapPin size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-200 line-clamp-2">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-950">
          <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>

          {/* Overlay Status Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none flex justify-center">
            <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700 shadow-xl max-w-lg pointer-events-auto flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 shrink-0">
                {isGeocoding ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-blue-400 font-semibold truncate">
                  {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {addressPreview || 'Klik di peta untuk mendapatkan alamat otomatis'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" size="md" onClick={handleConfirm} icon={<Check size={18} />}>
            Gunakan Lokasi Ini
          </Button>
        </div>
      </div>
    </div>
  );
};
