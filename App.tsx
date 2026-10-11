import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Download,
  MapPin,
  Calendar,
  Clock,
  Type,
  Sliders,
  Sparkles,
  RefreshCcw,
  LayoutTemplate,
  Share2,
  Map as MapIcon,
  X,
  Trash2,
  Save,
  RotateCw,
  Camera,
  Layers,
  FileText,
  Compass,
  Sun,
  Eye,
  Info,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { ImageCanvas } from './components/ImageCanvas';
import { Button } from './components/Button';
import { MapPickerModal } from './components/MapPickerModal';
import { CameraModal } from './components/CameraModal';
import { StampSettings, TextPosition, DateFormat, TemplateStyle, TemplatePreset } from './types';
import { analyzeImageForMetadata } from './services/geminiService';

declare var piexif: any;

const toDMS = (deg: number) => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutes = Math.floor((absolute - degrees) * 60);
  const seconds = (absolute - degrees - minutes / 60) * 3600;
  return [
    [degrees, 1],
    [minutes, 1],
    [Math.round(seconds * 100), 100],
  ];
};

const getNowIsoLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const DEFAULT_SETTINGS: StampSettings = {
  templateStyle: TemplateStyle.GPS_SURVEY,
  textPosition: TextPosition.BOTTOM_LEFT,

  // Date & Time
  showDate: true,
  showTime: true,
  showSeconds: true,
  showTimezone: true,
  timezoneLabel: 'WIB',
  customDate: getNowIsoLocal(),
  dateFormat: DateFormat.FULL_ID,

  // Location
  showLocation: true,
  customLocation: 'Jakarta Pusat, DKI Jakarta',
  showCoordinates: true,
  customCoordinates: '-6.2088, 106.8456',
  coordFormat: 'decimal',
  showAltitude: true,
  altitude: '18 m ASL',
  showWeather: true,
  weather: '31°C Cerah',

  // Project & Notes
  showProjectName: true,
  projectName: 'Dokumentasi Lapangan',
  showNotes: true,
  notes: 'Verifikasi fisik & koordinat',
  showSurveyor: false,
  surveyorName: '',

  // Map
  showMapOverlay: true,
  mapZoom: 15,
  mapShape: 'rounded',

  // Logo
  showLogo: false,
  logoSrc: null,
  logoPosition: 'stamp_right',

  // Typography
  baseFontSize: 18,
  timeFontSize: 24,
  dateFontSize: 20,
  locationFontSize: 18,
  coordinatesFontSize: 16,
  notesFontSize: 16,

  // Appearance
  textColor: '#ffffff',
  accentColor: '#f59e0b',
  textShadow: true,
  backgroundColor: '#090d16',
  backgroundOpacity: 75,
  paddingX: 20,
  paddingY: 18,
  borderRadius: 12,

  // Image Transformations
  rotation: 0,
  flipHorizontal: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

const PRESET_TEMPLATES: TemplatePreset[] = [
  {
    id: 'gps_survey_pro',
    name: 'GPS Survey Pro',
    description: 'Standar GPS Map Camera dengan data lengkap & peta mini',
    badge: 'Populer',
    settings: {
      templateStyle: TemplateStyle.GPS_SURVEY,
      textPosition: TextPosition.BOTTOM_LEFT,
      backgroundColor: '#090d16',
      backgroundOpacity: 80,
      textColor: '#ffffff',
      accentColor: '#f59e0b',
      textShadow: true,
      showMapOverlay: true,
      showCoordinates: true,
      showAltitude: true,
      showWeather: true,
      showProjectName: true,
      showNotes: true,
      timeFontSize: 26,
      dateFontSize: 20,
      locationFontSize: 18,
      coordinatesFontSize: 16,
      borderRadius: 12,
    },
  },
  {
    id: 'industry_bar',
    name: 'Industry Bar',
    description: 'Aksen garis vertikal oranye profesional',
    settings: {
      templateStyle: TemplateStyle.INDUSTRY,
      textPosition: TextPosition.BOTTOM_LEFT,
      backgroundColor: '#000000',
      backgroundOpacity: 65,
      textColor: '#ffffff',
      accentColor: '#f97316',
      textShadow: true,
      showMapOverlay: false,
      timeFontSize: 36,
      dateFontSize: 22,
      locationFontSize: 18,
      coordinatesFontSize: 16,
      borderRadius: 4,
    },
  },
  {
    id: 'classic_box',
    name: 'Classic Box',
    description: 'Kotak hitam rounded elegan & kontras',
    settings: {
      templateStyle: TemplateStyle.SIMPLE,
      textPosition: TextPosition.BOTTOM_RIGHT,
      backgroundColor: '#000000',
      backgroundOpacity: 70,
      textColor: '#ffffff',
      accentColor: '#38bdf8',
      textShadow: false,
      showMapOverlay: false,
      timeFontSize: 24,
      dateFontSize: 20,
      locationFontSize: 18,
      coordinatesFontSize: 16,
      borderRadius: 12,
    },
  },
  {
    id: 'modern_clean',
    name: 'Modern Clean',
    description: 'Latar putih minimalis dengan ikon bersih',
    settings: {
      templateStyle: TemplateStyle.MODERN,
      textPosition: TextPosition.BOTTOM_CENTER,
      backgroundColor: '#ffffff',
      backgroundOpacity: 92,
      textColor: '#0f172a',
      accentColor: '#0284c7',
      textShadow: false,
      showMapOverlay: false,
      timeFontSize: 22,
      dateFontSize: 18,
      locationFontSize: 18,
      coordinatesFontSize: 16,
      borderRadius: 8,
    },
  },
  {
    id: 'retro_digicam',
    name: 'Retro Digicam',
    description: 'Format digital LED oranye kamera 90-an',
    badge: 'Vintage',
    settings: {
      templateStyle: TemplateStyle.RETRO,
      textPosition: TextPosition.BOTTOM_RIGHT,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      textColor: '#f97316',
      accentColor: '#f97316',
      textShadow: true,
      showMapOverlay: false,
      showCoordinates: true,
      timeFontSize: 28,
      dateFontSize: 26,
      locationFontSize: 22,
      coordinatesFontSize: 20,
      borderRadius: 0,
    },
  },
  {
    id: 'full_banner',
    name: 'Full Banner',
    description: 'Banner bawah penuh untuk laporan resmi dinas/proyek',
    settings: {
      templateStyle: TemplateStyle.BOTTOM_BANNER,
      textPosition: TextPosition.BOTTOM_CENTER,
      backgroundColor: '#090d16',
      backgroundOpacity: 85,
      textColor: '#ffffff',
      accentColor: '#38bdf8',
      showMapOverlay: true,
      showCoordinates: true,
      showProjectName: true,
      timeFontSize: 22,
      dateFontSize: 18,
      locationFontSize: 16,
      coordinatesFontSize: 15,
      borderRadius: 0,
    },
  },
  {
    id: 'minimal_ghost',
    name: 'Minimal Ghost',
    description: 'Hanya teks dengan bayangan tajam tanpa background',
    settings: {
      templateStyle: TemplateStyle.MINIMAL,
      textPosition: TextPosition.BOTTOM_RIGHT,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      textColor: '#ffffff',
      accentColor: '#ffffff',
      textShadow: true,
      showMapOverlay: false,
      timeFontSize: 26,
      dateFontSize: 22,
      locationFontSize: 18,
      coordinatesFontSize: 16,
    },
  },
];

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [settings, setSettings] = useState<StampSettings>(DEFAULT_SETTINGS);
  const [customTemplates, setCustomTemplates] = useState<TemplatePreset[]>([]);

  // Modals & UI States
  const [activeTab, setActiveTab] = useState<'location' | 'time' | 'project' | 'style' | 'image' | 'ai'>('location');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load Saved Templates and Previous Settings
  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem('mkd_custom_templates_v2');
      if (savedTemplates) {
        setCustomTemplates(JSON.parse(savedTemplates));
      }
      const savedSettings = localStorage.getItem('mkd_settings_v2');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('Could not load preferences', e);
    }
  }, []);

  // Save Settings to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('mkd_settings_v2', JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }, [settings]);

  const updateSetting = <K extends keyof StampSettings>(key: K, value: StampSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          showToast('Foto berhasil dimuat!');

          // If photo has lastModified date, suggest using it
          if (file.lastModified) {
            const fileDate = new Date(file.lastModified);
            const iso = `${fileDate.getFullYear()}-${String(fileDate.getMonth() + 1).padStart(2, '0')}-${String(
              fileDate.getDate()
            ).padStart(2, '0')}T${String(fileDate.getHours()).padStart(2, '0')}:${String(
              fileDate.getMinutes()
            ).padStart(2, '0')}`;
            // Optional auto update date to file's date
            updateSetting('customDate', iso);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setImageSrc(dataUrl);
    updateSetting('customDate', getNowIsoLocal());
    showToast('Foto berhasil diambil dari kamera!');
  };

  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert('Perangkat Anda tidak mendukung fitur geolokasi.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, altitude } = pos.coords;
        const coordsStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        updateSetting('customCoordinates', coordsStr);

        if (altitude) {
          updateSetting('altitude', `${Math.round(altitude)} m ASL`);
        }

        // Reverse geocode via server
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              updateSetting('customLocation', data.display_name);
            }
          }
        } catch (e) {
          console.warn('Geocode fetch failed', e);
        }

        showToast('Lokasi GPS & koordinat berhasil diperbarui!');
      },
      (err) => {
        console.warn('GPS Error', err);
        alert('Gagal mengambil lokasi GPS. Pastikan izin GPS aktif.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationSelectFromMap = (lat: number, lng: number, address?: string) => {
    updateSetting('customCoordinates', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (address) {
      updateSetting('customLocation', address);
    }
    showToast('Koordinat peta berhasil diperbarui!');
  };

  const handleGeminiAnalysis = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    try {
      const metadata = await analyzeImageForMetadata(imageSrc);

      if (metadata.location) {
        updateSetting('customLocation', metadata.location);
      }
      if (metadata.coordinates) {
        updateSetting('customCoordinates', metadata.coordinates);
      }
      if (metadata.weather) {
        updateSetting('weather', metadata.weather);
      }
      if (metadata.description) {
        updateSetting('notes', metadata.description);
      }
      if (metadata.dateTime) {
        updateSetting('customDate', metadata.dateTime.slice(0, 16));
      }

      showToast('Analisis Gemini AI selesai! Metadata otomatis terisi.');
    } catch (err: any) {
      console.error('Gemini analysis failed', err);
      alert('Analisis Gemini AI tidak dapat memproses gambar saat ini: ' + (err.message || ''));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      if (typeof piexif !== 'undefined') {
        const dateObj = new Date(settings.customDate);
        const exifDate = !isNaN(dateObj.getTime())
          ? dateObj
              .toISOString()
              .replace(/[-T:]/g, ':')
              .slice(0, 19)
              .replace('::', ' ')
          : '';

        const exifObj: any = {
          '0th': {},
          Exif: {},
          GPS: {},
        };

        exifObj['0th'][piexif.ImageIFD.Software] = 'MKD-Timestamp AI Studio';

        if (exifDate) {
          exifObj['0th'][piexif.ImageIFD.DateTime] = exifDate;
          exifObj.Exif[piexif.ExifIFD.DateTimeOriginal] = exifDate;
          exifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = exifDate;
        }

        if (settings.showCoordinates && settings.customCoordinates) {
          const parts = settings.customCoordinates.split(',').map((s) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const [lat, lng] = parts;
            exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
            exifObj.GPS[piexif.GPSIFD.GPSLatitude] = toDMS(lat);
            exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = lng < 0 ? 'W' : 'E';
            exifObj.GPS[piexif.GPSIFD.GPSLongitude] = toDMS(lng);
          }
        }

        const exifBytes = piexif.dump(exifObj);
        const newJpeg = piexif.insert(exifBytes, dataUrl);

        const link = document.createElement('a');
        link.download = `MKD_Timestamp_${Date.now()}.jpg`;
        link.href = newJpeg;
        link.click();
        showToast('Foto tersimpan dengan metadata EXIF lengkap!');
        return;
      }
    } catch (e) {
      console.warn('EXIF injection failed, falling back to standard download', e);
    }

    const link = document.createElement('a');
    link.download = `MKD_Timestamp_${Date.now()}.jpg`;
    link.href = dataUrl;
    link.click();
    showToast('Foto berhasil diunduh!');
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, 'image/jpeg', 0.95)
      );
      if (!blob) return;

      const file = new File([blob], `mkd_timestamp_${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'MKD Timestamp Photo',
          text: `Dokumentasi foto dengan timestamp & lokasi: ${settings.customLocation}`,
        });
      } else {
        // Fallback copy to clipboard
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/jpeg': blob }),
          ]);
          showToast('Gambar disalin ke clipboard!');
        } else {
          showToast('Fitur share tidak didukung pada browser ini. Silakan gunakan tombol Unduh.');
        }
      }
    } catch (err) {
      console.warn('Share error', err);
    }
  };

  const handleRotate = () => {
    const nextRotation = (settings.rotation + 90) % 360;
    updateSetting('rotation', nextRotation);
  };

  const applyTemplate = (preset: Partial<StampSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...preset,
      // Retain personal text inputs
      customLocation: prev.customLocation,
      customCoordinates: prev.customCoordinates,
      customDate: prev.customDate,
      projectName: prev.projectName,
      notes: prev.notes,
    }));
    showToast(`Template diterapkan!`);
  };

  const handleSaveCustomTemplate = () => {
    if (!saveTemplateName.trim()) return;
    const newTemplate: TemplatePreset = {
      id: `custom_${Date.now()}`,
      name: saveTemplateName.trim(),
      description: 'Template kustom pengguna',
      badge: 'Kustom',
      isCustom: true,
      settings: { ...settings },
    };

    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('mkd_custom_templates_v2', JSON.stringify(updated));
    } catch (e) {}

    setSaveTemplateName('');
    setIsSaveModalOpen(false);
    showToast('Template berhasil disimpan!');
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('mkd_custom_templates_v2', JSON.stringify(updated));
    } catch (e) {}
    showToast('Template dihapus.');
  };

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-slate-800/95 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in text-sm font-medium">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={handleLocationSelectFromMap}
        initialLat={
          settings.customCoordinates
            ? parseFloat(settings.customCoordinates.split(',')[0]) || -6.2088
            : -6.2088
        }
        initialLng={
          settings.customCoordinates
            ? parseFloat(settings.customCoordinates.split(',')[1]) || 106.8456
            : 106.8456
        }
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Simpan Template Saat Ini</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nama Template</label>
              <input
                type="text"
                placeholder="Misal: Survey Lapangan Proyek A"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSaveModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCustomTemplate}
                disabled={!saveTemplateName.trim()}
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR CONTROLS */}
      <aside className="w-full md:w-[460px] lg:w-[480px] bg-[#0c1322] border-r border-slate-800 flex flex-col h-full shrink-0 z-20">
        {/* App Title & Quick Upload Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-[#0f172a]/90 backdrop-blur-sm flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-sm">
                MK
              </div>
              <h1 className="text-base font-bold tracking-tight text-white">MKD-Timestamp</h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Stempel Waktu & Lokasi GPS Foto Profesional
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Ambil Foto Kamera Langsung"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/20"
            >
              <Upload size={14} /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-[#0b101d] overflow-x-auto no-scrollbar px-2 py-1 gap-1">
          {[
            { id: 'location', label: 'Lokasi & GPS', icon: MapPin },
            { id: 'time', label: 'Waktu & Jam', icon: Clock },
            { id: 'project', label: 'Catatan Proyek', icon: FileText },
            { id: 'style', label: 'Gaya & Template', icon: LayoutTemplate },
            { id: 'image', label: 'Edit Foto', icon: Sliders },
            { id: 'ai', label: 'AI Gemini', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {/* TAB: LOKASI & GPS */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-400" /> Nama Lokasi & Alamat
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showLocation}
                      onChange={(e) => updateSetting('showLocation', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>

                {settings.showLocation && (
                  <div className="space-y-2.5">
                    <textarea
                      rows={2}
                      value={settings.customLocation}
                      onChange={(e) => updateSetting('customLocation', e.target.value)}
                      placeholder="Contoh: Jl. MH Thamrin No. 1, Jakarta Pusat"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 leading-relaxed"
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleGetDeviceLocation}
                        icon={<Compass size={14} />}
                        className="flex-1 text-[11px]"
                      >
                        GPS Perangkat
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsMapOpen(true)}
                        icon={<MapIcon size={14} />}
                        className="flex-1 text-[11px]"
                      >
                        Pilih di Peta
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Coordinates Section */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Compass size={14} className="text-amber-400" /> Koordinat GPS
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showCoordinates}
                      onChange={(e) => updateSetting('showCoordinates', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>

                {settings.showCoordinates && (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={settings.customCoordinates}
                      onChange={(e) => updateSetting('customCoordinates', e.target.value)}
                      placeholder="-6.208800, 106.845600"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Format Koordinat</label>
                        <select
                          value={settings.coordFormat}
                          onChange={(e) => updateSetting('coordFormat', e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        >
                          <option value="decimal">Desimal (-6.2088° S, 106.8456° E)</option>
                          <option value="dms">DMS (6°12'31" S, 106°50'44" E)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Ketinggian / Elevasi</label>
                        <input
                          type="text"
                          value={settings.altitude}
                          onChange={(e) => updateSetting('altitude', e.target.value)}
                          placeholder="45 m ASL"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mini Map Overlay */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <MapIcon size={14} className="text-emerald-400" /> Mini Map Watermark
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showMapOverlay}
                      onChange={(e) => updateSetting('showMapOverlay', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Aktif</span>
                  </label>
                </div>

                {settings.showMapOverlay && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Bentuk Peta</label>
                      <select
                        value={settings.mapShape}
                        onChange={(e) => updateSetting('mapShape', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="rounded">Kotak Membulat</option>
                        <option value="circle">Lingkaran (Circle)</option>
                        <option value="square">Persegi</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Zoom Peta</span>
                        <span>{settings.mapZoom || 15}x</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="18"
                        value={settings.mapZoom || 15}
                        onChange={(e) => updateSetting('mapZoom', Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Weather & Environment */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Sun size={14} className="text-yellow-400" /> Cuaca / Kondisi Suhu
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showWeather}
                      onChange={(e) => updateSetting('showWeather', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                {settings.showWeather && (
                  <input
                    type="text"
                    value={settings.weather}
                    onChange={(e) => updateSetting('weather', e.target.value)}
                    placeholder="31°C Cerah Berawan"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB: WAKTU & JAM */}
          {activeTab === 'time' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-400" /> Waktu Pengambilan Foto
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showDate || settings.showTime}
                      onChange={(e) => {
                        updateSetting('showDate', e.target.checked);
                        updateSetting('showTime', e.target.checked);
                      }}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Aktif</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="datetime-local"
                    value={settings.customDate}
                    onChange={(e) => updateSetting('customDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                  />

                  {/* Preset Quick Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] py-1"
                      onClick={() => updateSetting('customDate', getNowIsoLocal())}
                    >
                      Sekarang (Live)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] py-1"
                      onClick={() => {
                        const d = new Date(settings.customDate);
                        d.setHours(d.getHours() - 1);
                        updateSetting('customDate', d.toISOString().slice(0, 16));
                      }}
                    >
                      -1 Jam
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] py-1"
                      onClick={() => {
                        const d = new Date(settings.customDate);
                        d.setDate(d.getDate() - 1);
                        updateSetting('customDate', d.toISOString().slice(0, 16));
                      }}
                    >
                      Kemarin
                    </Button>
                  </div>
                </div>
              </div>

              {/* Format Options */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Format Tanggal & Waktu
                </span>

                <div className="space-y-2">
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => updateSetting('dateFormat', e.target.value as DateFormat)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value={DateFormat.FULL_ID}>Bahasa Indonesia (Kamis, 15 Oktober 2026)</option>
                    <option value={DateFormat.LOCAL}>Standar Singkat (15/10/2026)</option>
                    <option value={DateFormat.GPS_STANDARD}>Standar GPS (15-Okt-2026)</option>
                    <option value={DateFormat.ISO}>ISO 8601 (2026-10-15)</option>
                    <option value={DateFormat.RETRO}>Retro Digicam (10.15.'26)</option>
                  </select>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showSeconds}
                        onChange={(e) => updateSetting('showSeconds', e.target.checked)}
                        className="rounded bg-slate-700 border-slate-600 text-blue-500"
                      />
                      <span>Tampilkan Detik (:ss)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTimezone}
                        onChange={(e) => updateSetting('showTimezone', e.target.checked)}
                        className="rounded bg-slate-700 border-slate-600 text-blue-500"
                      />
                      <span>Zona Waktu</span>
                    </label>
                  </div>

                  {settings.showTimezone && (
                    <div className="pt-2">
                      <label className="text-[10px] text-slate-400 block mb-1">Pilihan Zona Waktu</label>
                      <div className="flex gap-1.5">
                        {['WIB', 'WITA', 'WIT', 'GMT+7', 'UTC'].map((tz) => (
                          <button
                            key={tz}
                            onClick={() => updateSetting('timezoneLabel', tz)}
                            className={`px-2.5 py-1 text-xs rounded font-mono ${
                              settings.timezoneLabel === tz
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {tz}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CATATAN PROYEK */}
          {activeTab === 'project' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" /> Judul Proyek / Pekerjaan
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showProjectName}
                      onChange={(e) => updateSetting('showProjectName', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                {settings.showProjectName && (
                  <input
                    type="text"
                    value={settings.projectName}
                    onChange={(e) => updateSetting('projectName', e.target.value)}
                    placeholder="Contoh: Proyek Drainase Paket IV"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                )}
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Info size={14} className="text-amber-400" /> Catatan / Keterangan Lapangan
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showNotes}
                      onChange={(e) => updateSetting('showNotes', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                {settings.showNotes && (
                  <textarea
                    rows={2}
                    value={settings.notes}
                    onChange={(e) => updateSetting('notes', e.target.value)}
                    placeholder="Contoh: Kondisi fisik pekerjaan 85%, cuaca cerah"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                  />
                )}
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Eye size={14} className="text-emerald-400" /> Nama Petugas / Surveyor
                  </span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={settings.showSurveyor}
                      onChange={(e) => updateSetting('showSurveyor', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                {settings.showSurveyor && (
                  <input
                    type="text"
                    value={settings.surveyorName}
                    onChange={(e) => updateSetting('surveyorName', e.target.value)}
                    placeholder="Nama Surveyor / Tim Pengawas"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB: GAYA & TEMPLATE */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              {/* Template Presets Grid */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <LayoutTemplate size={14} className="text-blue-400" /> Pilihan Template
                  </span>
                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Save size={13} /> Simpan Gaya Ini
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[...customTemplates, ...PRESET_TEMPLATES].map((preset) => {
                    const isSelected = settings.templateStyle === preset.settings.templateStyle;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => applyTemplate(preset.settings)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative group ${
                          isSelected
                            ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50'
                            : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-700'
                        }`}
                      >
                        {preset.isCustom && (
                          <button
                            onClick={(e) => handleDeleteTemplate(preset.id, e)}
                            className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Hapus template kustom"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {preset.name}
                          </span>
                          {preset.badge && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-semibold">
                              {preset.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Posisi Stempel */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Posisi Stempel di Foto
                </span>
                <select
                  value={settings.textPosition}
                  onChange={(e) => updateSetting('textPosition', e.target.value as TextPosition)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  {Object.values(TextPosition).map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warna & Transparansi */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Warna & Transparansi
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Warna Teks</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={settings.textColor}
                        onChange={(e) => updateSetting('textColor', e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.textColor}
                        onChange={(e) => updateSetting('textColor', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Warna Aksen / Bar</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={settings.accentColor || '#f59e0b'}
                        onChange={(e) => updateSetting('accentColor', e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.accentColor || '#f59e0b'}
                        onChange={(e) => updateSetting('accentColor', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Opasitas Latar Belakang (Transparansi Box)</span>
                    <span>{settings.backgroundOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.backgroundOpacity}
                    onChange={(e) => updateSetting('backgroundOpacity', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="textShadowCheck"
                    checked={settings.textShadow}
                    onChange={(e) => updateSetting('textShadow', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-blue-500"
                  />
                  <label htmlFor="textShadowCheck" className="text-xs text-slate-300 cursor-pointer">
                    Efek Drop Shadow Teks (Tajam & Jelas)
                  </label>
                </div>
              </div>

              {/* Ukuran Font Terperinci */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Ukuran Teks
                </span>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Waktu & Jam</span>
                      <span>{settings.timeFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="14"
                      max="60"
                      value={settings.timeFontSize}
                      onChange={(e) => updateSetting('timeFontSize', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Tanggal</span>
                      <span>{settings.dateFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      value={settings.dateFontSize}
                      onChange={(e) => updateSetting('dateFontSize', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Lokasi & Alamat</span>
                      <span>{settings.locationFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="40"
                      value={settings.locationFontSize}
                      onChange={(e) => updateSetting('locationFontSize', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EDIT FOTO */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Orientasi & Rotasi Foto
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRotate}
                    icon={<RotateCw size={14} />}
                  >
                    Putar 90° ({settings.rotation}°)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateSetting('flipHorizontal', !settings.flipHorizontal)}
                  >
                    {settings.flipHorizontal ? 'Flip Aktif' : 'Flip Normal'}
                  </Button>
                </div>
              </div>

              {/* Adjustments */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-300 block">
                  Penyesuaian Kualitas Gambar
                </span>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Kecerahan (Brightness)</span>
                      <span>{settings.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="140"
                      value={settings.brightness}
                      onChange={(e) => updateSetting('brightness', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Kontras</span>
                      <span>{settings.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="140"
                      value={settings.contrast}
                      onChange={(e) => updateSetting('contrast', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Saturasi Warna</span>
                      <span>{settings.saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="160"
                      value={settings.saturation}
                      onChange={(e) => updateSetting('saturation', Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: GEMINI AI */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-950/40 via-blue-950/30 to-slate-900 p-5 rounded-2xl border border-blue-500/20 space-y-4 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Analisis Visual Gemini AI</h3>
                    <p className="text-[11px] text-slate-400">
                      Model Gemini 3.8 Flash mendeteksi lokasi visual, cuaca, dan deskripsi lapangan
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Cukup upload foto, lalu jalankan analisis AI. Gemini akan mengidentifikasi landmark,
                  kota/provinsi, perkiraan koordinat, kondisi cuaca, dan membuat catatan dokumentasi
                  lapangan secara otomatis.
                </p>

                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleGeminiAnalysis}
                  disabled={!imageSrc}
                  isLoading={isAnalyzing}
                  icon={<Sparkles size={16} />}
                >
                  {isAnalyzing ? 'Menganalisis Foto...' : 'Jalankan Analisis AI'}
                </Button>

                {!imageSrc && (
                  <p className="text-[11px] text-amber-400/90 text-center">
                    Silakan upload atau ambil foto terlebih dahulu.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM EXPORT & SHARE BAR */}
        <div className="p-4 border-t border-slate-800 bg-[#0c1322] space-y-2">
          <Button
            onClick={handleDownload}
            disabled={!imageSrc}
            className="w-full"
            variant="primary"
            size="md"
            icon={<Download size={18} />}
          >
            Simpan & Unduh Foto (EXIF GPS)
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleShare}
              disabled={!imageSrc}
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              icon={<Share2 size={15} />}
            >
              Bagikan / Salin
            </Button>
            <Button
              onClick={() => setSettings(DEFAULT_SETTINGS)}
              variant="outline"
              size="sm"
              className="text-xs px-3"
              title="Reset ke Pengaturan Awal"
            >
              <RefreshCcw size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN CANVAS PREVIEW STAGE */}
      <main className="flex-1 bg-[#070a12] flex flex-col h-full overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-[#090d16]/70 backdrop-blur-md flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Live Preview Watermark</span>
            {imageSrc && (
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Resolusi Penuh Aktif
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {imageSrc && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRotate}
                icon={<RotateCw size={14} />}
                className="text-xs"
              >
                Putar
              </Button>
            )}
          </div>
        </div>

        {/* Canvas Center Area */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 flex items-center justify-center overflow-hidden">
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
