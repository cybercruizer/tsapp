import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, MapPin, Calendar, Type, Sliders, Wand2, RefreshCcw, LayoutTemplate, Share2, Map as MapIcon, X, Plus, Trash2, Save } from 'lucide-react';
import { ImageCanvas } from './components/ImageCanvas';
import { Button } from './components/Button';
import { StampSettings, TextPosition, DateFormat, TemplateStyle } from './types';
import { analyzeImageForMetadata } from './services/geminiService';

// Declare globals for libraries loaded via CDN
declare var L: any;
declare var piexif: any;

const DEFAULT_SETTINGS: StampSettings = {
  templateStyle: TemplateStyle.SIMPLE,
  textPosition: TextPosition.BOTTOM_RIGHT,
  showDate: true,
  customDate: new Date().toISOString().slice(0, 16),
  dateFormat: DateFormat.LOCAL,
  showLocation: true,
  customLocation: '',
  showCoordinates: false,
  customCoordinates: '',
  showMapOverlay: false,
  
  // Default sizes
  timeFontSize: 32,
  dateFontSize: 24,
  locationFontSize: 20,
  coordinatesFontSize: 16,

  textColor: '#ffffff',
  textShadow: false,
  backgroundColor: '#000000',
  backgroundOpacity: 60,
  paddingX: 20,
  paddingY: 20,
  borderRadius: 12
};

interface Template {
  id: string;
  name: string;
  description: string;
  settings: StampSettings;
  isCustom?: boolean;
}

const PRESET_TEMPLATES: Template[] = [
  {
    id: 'industry',
    name: 'Industry',
    description: 'Professional, vertical bar',
    settings: { 
      ...DEFAULT_SETTINGS, 
      templateStyle: TemplateStyle.INDUSTRY,
      textPosition: TextPosition.BOTTOM_LEFT, 
      borderRadius: 4, 
      backgroundColor: '#000000', 
      backgroundOpacity: 50, 
      textColor: '#ffffff', 
      textShadow: true,
      timeFontSize: 48,
      dateFontSize: 24,
      locationFontSize: 18,
      coordinatesFontSize: 16,
      paddingX: 24,
      paddingY: 24,
      showCoordinates: true,
      showMapOverlay: false
    }
  },
  {
    id: 'classic',
    name: 'Classic Box',
    description: 'Simple rounded box',
    settings: { 
      ...DEFAULT_SETTINGS, 
      templateStyle: TemplateStyle.SIMPLE,
      textPosition: TextPosition.BOTTOM_RIGHT, 
      borderRadius: 12, 
      backgroundColor: '#000000', 
      backgroundOpacity: 60, 
      textColor: '#ffffff', 
      textShadow: false,
      timeFontSize: 24,
      dateFontSize: 24,
      locationFontSize: 24,
      coordinatesFontSize: 18,
      showMapOverlay: false
    }
  },
  {
    id: 'modern',
    name: 'Modern Clean',
    description: 'White minimalist',
    settings: { 
      ...DEFAULT_SETTINGS, 
      templateStyle: TemplateStyle.MODERN,
      textPosition: TextPosition.BOTTOM_CENTER, 
      borderRadius: 8, 
      backgroundColor: '#ffffff', 
      backgroundOpacity: 90, 
      textColor: '#0f172a', 
      textShadow: false,
      timeFontSize: 22,
      dateFontSize: 22,
      locationFontSize: 22,
      coordinatesFontSize: 18,
      showMapOverlay: false
    }
  },
  {
    id: 'retro',
    name: 'Retro Cam',
    description: 'Old digital camera style',
    settings: { 
      ...DEFAULT_SETTINGS, 
      templateStyle: TemplateStyle.RETRO,
      textPosition: TextPosition.BOTTOM_RIGHT, 
      borderRadius: 0, 
      backgroundColor: '#000000', 
      backgroundOpacity: 0, 
      textColor: '#F97316', 
      textShadow: true,
      timeFontSize: 28,
      dateFontSize: 28,
      locationFontSize: 28,
      coordinatesFontSize: 28,
      showMapOverlay: false
    }
  }
];

// Helper to convert decimal deg to DMS for EXIF
const toDMS = (deg: number) => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutes = Math.floor((absolute - degrees) * 60);
  const seconds = (absolute - degrees - minutes / 60) * 3600;
  return [[degrees, 1], [minutes, 1], [Math.round(seconds * 100), 100]];
};

const MapPickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean; onClose: () => void; onSelect: (lat: number, lng: number) => void }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Init map
      const map = L.map(mapContainerRef.current).setView([-6.2088, 106.8456], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
           markerRef.current.setLatLng([lat, lng]);
        } else {
           markerRef.current = L.marker([lat, lng]).addTo(map);
        }
        onSelect(lat, lng);
      });

      // Try to get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 15);
                if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
                else markerRef.current = L.marker([latitude, longitude]).addTo(map);
                onSelect(latitude, longitude);
            },
            () => console.log('Location access denied')
        );
      }
      
      mapInstanceRef.current = map;
    } else {
      // Invalidate size to ensure tiles render correctly if modal was hidden
      setTimeout(() => {
         mapInstanceRef.current.invalidateSize();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl h-[500px] flex flex-col shadow-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MapIcon size={20} className="text-blue-400"/> Pick Location
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        <div className="flex-1 relative bg-slate-900">
          <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 px-4 py-2 rounded-lg text-xs text-slate-300 pointer-events-none backdrop-blur shadow-lg border border-slate-700">
            Click on the map to set coordinates
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex justify-end">
           <Button onClick={onClose}>Confirm Location</Button>
        </div>
      </div>
    </div>
  );
};

const SaveTemplateModal = ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (name: string) => void }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl border border-slate-700 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Save Template</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Template Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Style"
            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500 text-white"
            autoFocus
          />
        </div>
        <div className="flex justify-end pt-2">
           <Button onClick={() => onSave(name)} disabled={!name.trim()}>Save Template</Button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [settings, setSettings] = useState<StampSettings>(DEFAULT_SETTINGS);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Persistence Logic (Database Config / Migrations)
  useEffect(() => {
    // 1. Load Custom Templates
    try {
      const savedTemplates = localStorage.getItem('mkd_custom_templates');
      if (savedTemplates) {
        setCustomTemplates(JSON.parse(savedTemplates));
      }
    } catch (e) {
      console.error("Failed to load templates", e);
    }

    // 2. Load Last Active Configuration (Config Migration)
    try {
        const savedSettings = localStorage.getItem('mkd_settings_v1');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // Migration: Merge saved settings into defaults to ensure new fields are present
            // We exclude content-specific fields like customDate if we want purely config, 
            // but for a smooth UX we reload everything.
            setSettings(prev => ({ ...prev, ...parsed }));
        }
    } catch (e) {
        console.error("Failed to load settings config", e);
    }
  }, []);

  // Save Settings on Change
  useEffect(() => {
    localStorage.setItem('mkd_settings_v1', JSON.stringify(settings));
  }, [settings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          // Reset location data on new image
          setSettings(prev => ({
            ...prev,
            customLocation: '',
            customCoordinates: ''
          }));
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAIAnalysis = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    try {
      const metadata = await analyzeImageForMetadata(imageSrc);
      setSettings(prev => ({
        ...prev,
        customLocation: metadata.location || prev.customLocation,
        customDate: metadata.dateTime || prev.customDate,
        customCoordinates: metadata.coordinates || prev.customCoordinates,
        showLocation: !!metadata.location,
        showCoordinates: !!metadata.coordinates
      }));
    } catch (error) {
      console.error("Analysis failed", error);
      alert("AI Analysis could not extract data. Please try again or enter manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = async () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
      
      try {
        // Prepare EXIF data
        const dateObj = new Date(settings.customDate);
        const exifDate = !isNaN(dateObj.getTime()) 
          ? dateObj.toISOString().replace(/[-T:]/g, ':').slice(0, 19).replace('::', ' ') // Format: "YYYY:MM:DD HH:MM:SS"
          : "";

        const exifObj = {
          "0th": {},
          "Exif": {},
          "GPS": {},
        };

        // EXIF: Clean Software Tag
        exifObj["0th"][piexif.ImageIFD.Software] = "Camera"; // Neutral value

        if (exifDate) {
           exifObj["0th"][piexif.ImageIFD.DateTime] = exifDate;
           exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = exifDate;
           exifObj["Exif"][piexif.ExifIFD.DateTimeDigitized] = exifDate;
        }

        // Add GPS if coordinates present
        if (settings.showCoordinates && settings.customCoordinates) {
          const parts = settings.customCoordinates.split(',').map(s => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
             const lat = parts[0];
             const lng = parts[1];
             
             exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
             exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = toDMS(lat);
             exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lng < 0 ? 'W' : 'E';
             exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = toDMS(lng);
          }
        }

        const exifBytes = piexif.dump(exifObj);
        const newJpeg = piexif.insert(exifBytes, dataUrl);

        const link = document.createElement('a');
        link.download = `mkd_timestamp_${Date.now()}.jpg`;
        link.href = newJpeg;
        link.click();

      } catch (e) {
        console.error("EXIF Error:", e);
        // Fallback to normal download if EXIF fails
        const link = document.createElement('a');
        link.download = `mkd_timestamp_${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
      }
    }
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => 
        canvasRef.current!.toBlob(resolve, 'image/jpeg', 0.95)
      );
      if (!blob) return;
      const file = new File([blob], 'geostamp.jpg', { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My GeoStamp Photo',
          text: 'Check out this photo I customized with GeoStamp AI!',
        });
      } else {
        alert("Native sharing is not supported on this device. Please use the 'Save to Gallery' button.");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const applyTemplate = (templateSettings: StampSettings) => {
    setSettings(prev => ({
      ...templateSettings,
      showDate: prev.showDate,
      customDate: prev.customDate,
      showLocation: prev.showLocation,
      customLocation: prev.customLocation,
      showCoordinates: prev.showCoordinates,
      customCoordinates: prev.customCoordinates
    }));
  };

  const handleSaveTemplate = (name: string) => {
    const newTemplate: Template = {
      id: `custom_${Date.now()}`,
      name,
      description: 'Custom saved style',
      settings: { ...settings },
      isCustom: true
    };
    const updated = [newTemplate, ...customTemplates]; // Add to top
    setCustomTemplates(updated);
    localStorage.setItem('mkd_custom_templates', JSON.stringify(updated));
    setIsSaveTemplateOpen(false);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm('Are you sure you want to delete this template?')) {
      const updated = customTemplates.filter(t => t.id !== id);
      setCustomTemplates(updated);
      localStorage.setItem('mkd_custom_templates', JSON.stringify(updated));
    }
  };

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const updateSetting = <K extends keyof StampSettings>(key: K, value: StampSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
      const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      updateSetting('customCoordinates', coords);
      
      // Attempt reverse geocode using generic OSM API (Free, rate limited)
      try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const city = data.address.city || data.address.town || data.address.village || data.address.county || "";
          const country = data.address.country || "";
          if (city) {
              updateSetting('customLocation', `${city}, ${country}`);
          }
      } catch (e) {
          console.warn("Could not reverse geocode");
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      <MapPickerModal 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)} 
        onSelect={handleLocationSelect} 
      />
      <SaveTemplateModal 
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        onSave={handleSaveTemplate}
      />

      {/* Sidebar */}
      <aside className="w-full md:w-[420px] bg-slate-800 border-r border-slate-700 flex flex-col h-screen overflow-hidden">
        <div className="p-6 border-b border-slate-700 bg-slate-800 z-10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            MKD-Timestamp
          </h1>
          <p className="text-xs text-slate-400">Professional Photo Metadata & Stamping</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Upload */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Upload size={16} /> Source
            </h2>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-blue-500 hover:bg-slate-750 transition-colors">
                   <span className="text-sm font-medium text-slate-300">Choose Photo</span>
                </div>
              </label>
              {imageSrc && (
                <Button 
                  onClick={handleAIAnalysis} 
                  isLoading={isAnalyzing} 
                  variant="secondary"
                  className="px-3"
                  title="Auto-detect location & time"
                >
                  <Wand2 size={18} />
                </Button>
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <LayoutTemplate size={16} /> Templates
                </h2>
                <button 
                  onClick={() => setIsSaveTemplateOpen(true)}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Save current settings as template"
                >
                  <Save size={14} /> Save Current
                </button>
             </div>
            <div className="grid grid-cols-2 gap-3">
              {[...customTemplates, ...PRESET_TEMPLATES].map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.settings)}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-all text-left group relative overflow-hidden ${
                      settings.templateStyle === t.settings.templateStyle && 
                      settings.backgroundColor === t.settings.backgroundColor &&
                      settings.textPosition === t.settings.textPosition &&
                      !t.isCustom // Crude check to differentiate slightly if duplicate styles
                      ? 'border-blue-500 bg-slate-750 ring-1 ring-blue-500/50' 
                      : 'border-slate-700 bg-slate-750 hover:bg-slate-700 hover:border-blue-400'
                  }`}
                >
                  {t.isCustom && (
                    <div 
                      onClick={(e) => handleDeleteTemplate(t.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-slate-800/80 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-900 z-10 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete Template"
                    >
                      <Trash2 size={12} />
                    </div>
                  )}
                  <div 
                    className="w-full h-12 mb-2 rounded flex items-center justify-center text-[10px] font-bold shadow-sm relative overflow-hidden"
                    style={{ 
                      backgroundColor: '#334155' 
                    }}
                  >
                     <div 
                        className={`absolute px-2 py-1 rounded flex items-center gap-1
                            ${t.settings.textPosition.includes('Left') ? 'left-1' : ''}
                            ${t.settings.textPosition.includes('Right') ? 'right-1' : ''}
                            ${t.settings.textPosition.includes('Center') ? 'left-1/2 -translate-x-1/2' : ''}
                            ${t.settings.textPosition.includes('Top') ? 'top-1' : 'bottom-1'}
                        `}
                        style={{
                           backgroundColor: t.settings.backgroundOpacity === 0 ? 'transparent' : t.settings.backgroundColor,
                           opacity: t.settings.backgroundOpacity === 0 ? 1 : t.settings.backgroundOpacity/100,
                           color: t.settings.textColor
                        }}
                     >
                       {t.settings.templateStyle === TemplateStyle.INDUSTRY && (
                         <div className="w-1 h-3 bg-amber-400 mr-1"></div>
                       )}
                       <span style={{ textShadow: t.settings.textShadow ? '1px 1px 1px rgba(0,0,0,0.8)' : 'none' }}>
                         ABC
                       </span>
                     </div>
                  </div>
                  <div className="w-full">
                    <div className="text-xs font-medium text-slate-200 flex items-center gap-1">
                      {t.name}
                      {t.isCustom && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" title="Custom Template"></span>}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate w-full">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content Settings */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Type size={16} /> Content & Sizes
            </h2>

            {/* Date */}
            <div className="space-y-3 bg-slate-750/50 p-3 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={settings.showDate} 
                    onChange={(e) => updateSetting('showDate', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span>Show Date</span>
                </label>
                <Calendar size={14} className="text-slate-500" />
              </div>
              
              {settings.showDate && (
                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                  <input 
                    type="datetime-local" 
                    value={settings.customDate}
                    onChange={(e) => updateSetting('customDate', e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500"
                  />
                  <select 
                    value={settings.dateFormat}
                    onChange={(e) => updateSetting('dateFormat', e.target.value as DateFormat)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500"
                  >
                    <option value={DateFormat.LOCAL}>DD/MM/YYYY HH:MM</option>
                    <option value={DateFormat.ISO}>ISO 8601</option>
                    <option value={DateFormat.FULL}>Full Date</option>
                  </select>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-slate-400">Time Size</label>
                          <span className="text-[10px] text-slate-500">{settings.timeFontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="100" 
                            value={settings.timeFontSize}
                            onChange={(e) => updateSetting('timeFontSize', Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                     <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-slate-400">Date Size</label>
                          <span className="text-[10px] text-slate-500">{settings.dateFontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="100" 
                            value={settings.dateFontSize}
                            onChange={(e) => updateSetting('dateFontSize', Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-3 bg-slate-750/50 p-3 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={settings.showLocation} 
                    onChange={(e) => updateSetting('showLocation', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span>Show Location</span>
                </label>
                <MapPin size={14} className="text-slate-500" />
              </div>
              {settings.showLocation && (
                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                    <input 
                    type="text" 
                    placeholder="e.g. Jakarta, Indonesia"
                    value={settings.customLocation}
                    onChange={(e) => updateSetting('customLocation', e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500"
                    />
                    <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-slate-400">Location Size</label>
                          <span className="text-[10px] text-slate-500">{settings.locationFontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="100" 
                            value={settings.locationFontSize}
                            onChange={(e) => updateSetting('locationFontSize', Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
              )}
            </div>

            {/* Coordinates */}
             <div className="space-y-3 bg-slate-750/50 p-3 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={settings.showCoordinates} 
                    onChange={(e) => updateSetting('showCoordinates', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span>Show Coordinates</span>
                </label>
                <div className="text-[10px] font-mono text-slate-500">LAT,LNG</div>
              </div>
              {settings.showCoordinates && (
                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                    <div className="flex gap-2">
                        <input 
                        type="text" 
                        placeholder="-6.2088, 106.8456"
                        value={settings.customCoordinates}
                        onChange={(e) => updateSetting('customCoordinates', e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <button 
                            onClick={() => setIsMapOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 p-2 rounded text-white"
                            title="Pick from Map"
                        >
                            <MapIcon size={16} />
                        </button>
                    </div>
                    
                    <label className="flex items-center gap-2 text-xs py-1">
                      <input 
                        type="checkbox" 
                        checked={settings.showMapOverlay} 
                        onChange={(e) => updateSetting('showMapOverlay', e.target.checked)}
                        className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Show Mini Map Overlay</span>
                    </label>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-slate-400">Coords Size</label>
                          <span className="text-[10px] text-slate-500">{settings.coordinatesFontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="100" 
                            value={settings.coordinatesFontSize}
                            onChange={(e) => updateSetting('coordinatesFontSize', Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
              )}
            </div>
          </div>

          {/* Style Settings */}
          <div className="space-y-4">
             <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders size={16} /> Appearance
            </h2>
            
            <div>
            <label className="text-xs text-slate-400 block mb-1">Position</label>
            <select 
                value={settings.textPosition}
                onChange={(e) => updateSetting('textPosition', e.target.value as TextPosition)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500"
            >
                {Object.values(TextPosition).map(pos => (
                <option key={pos} value={pos}>{pos}</option>
                ))}
            </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-xs text-slate-400 block mb-1">Text Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings.textColor}
                    onChange={(e) => updateSetting('textColor', e.target.value)}
                    className="h-9 w-9 rounded bg-transparent cursor-pointer border border-slate-600 shrink-0"
                  />
                  <input 
                    type="text"
                    value={settings.textColor}
                    onChange={(e) => updateSetting('textColor', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-sm w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bg Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings.backgroundColor}
                    onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                    className="h-9 w-9 rounded bg-transparent cursor-pointer border border-slate-600 shrink-0"
                  />
                   <input 
                    type="text"
                    value={settings.backgroundColor}
                    onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-sm w-full"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-400 block mb-1">Transparency</label>
                <span className="text-xs text-slate-400">{settings.backgroundOpacity}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={settings.backgroundOpacity}
                onChange={(e) => updateSetting('backgroundOpacity', Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            
            <div className="p-3 bg-slate-750/50 rounded border border-slate-700/50">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">Background Box</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Pad Width (X)</label>
                        <input 
                        type="number" 
                        value={settings.paddingX}
                        onChange={(e) => updateSetting('paddingX', Number(e.target.value))}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm w-full"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Pad Height (Y)</label>
                        <input 
                        type="number" 
                        value={settings.paddingY}
                        onChange={(e) => updateSetting('paddingY', Number(e.target.value))}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm w-full"
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-slate-400">Corner Radius</label>
                      <span className="text-[10px] text-slate-500">{settings.borderRadius}px</span>
                    </div>
                    <input 
                        type="range" min="0" max="50"
                        value={settings.borderRadius}
                        onChange={(e) => updateSetting('borderRadius', Number(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

             <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={settings.textShadow} 
                  onChange={(e) => updateSetting('textShadow', e.target.checked)}
                  id="textShadow"
                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="textShadow" className="text-sm">Text Drop Shadow</label>
             </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-slate-700 bg-slate-800 space-y-3">
          <Button 
            onClick={handleDownload} 
            disabled={!imageSrc} 
            className="w-full"
            icon={<Download size={18} />}
          >
            Save to Gallery (with EXIF)
          </Button>

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={handleShare}
              disabled={!imageSrc}
              variant="secondary"
              className="w-full"
              icon={<Share2 size={16} />}
            >
              Share Image
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 bg-slate-900 p-8 flex flex-col h-screen overflow-hidden relative">
        <div className="flex justify-end mb-4">
           {imageSrc && (
             <button 
              onClick={() => {
                setSettings(DEFAULT_SETTINGS);
              }}
              className="text-slate-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
             >
               <RefreshCcw size={14} /> Reset Settings
             </button>
           )}
        </div>
        
        <div className="flex-1 relative bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center p-4 overflow-hidden">
          <ImageCanvas 
            imageSrc={imageSrc} 
            settings={settings} 
            onCanvasReady={handleCanvasReady} 
          />
        </div>
      </main>
    </div>
  );
}