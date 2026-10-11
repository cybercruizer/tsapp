export enum TextPosition {
  TOP_LEFT = 'Top Left',
  TOP_RIGHT = 'Top Right',
  BOTTOM_LEFT = 'Bottom Left',
  BOTTOM_RIGHT = 'Bottom Right',
  TOP_CENTER = 'Top Center',
  BOTTOM_CENTER = 'Bottom Center',
  CENTER = 'Center'
}

export enum DateFormat {
  LOCAL = 'DD/MM/YYYY HH:mm',
  LOCAL_SEC = 'DD/MM/YYYY HH:mm:ss',
  FULL_ID = 'Hari, DD Bulan YYYY HH:mm',
  ISO = 'YYYY-MM-DD HH:mm:ss',
  RETRO = 'MM.DD.YY HH:mm',
  GPS_STANDARD = 'DD-MMM-YYYY HH:mm GMT+7'
}

export enum TemplateStyle {
  GPS_SURVEY = 'GPS Survey Pro',
  INDUSTRY = 'Industry',
  SIMPLE = 'Classic Box',
  MODERN = 'Modern Clean',
  RETRO = 'Retro Digicam',
  MINIMAL = 'Minimal Ghost',
  BOTTOM_BANNER = 'Full Banner',
  BADGE_STAMP = 'Official Badge'
}

export interface StampSettings {
  templateStyle: TemplateStyle;
  textPosition: TextPosition;

  // Content - Date & Time
  showDate: boolean;
  showTime: boolean;
  showSeconds: boolean;
  showTimezone: boolean;
  timezoneLabel: string;
  customDate: string; // ISO string e.g. "2026-10-15T14:30"
  dateFormat: DateFormat;

  // Content - Location
  showLocation: boolean;
  customLocation: string;
  showCoordinates: boolean;
  customCoordinates: string; // "lat, lng"
  coordFormat: 'decimal' | 'dms';
  showAltitude: boolean;
  altitude: string; // e.g. "45 m ASL"
  showWeather: boolean;
  weather: string; // e.g. "31°C Cerah"

  // Content - Notes / Project
  showProjectName: boolean;
  projectName: string;
  showNotes: boolean;
  notes: string;
  showSurveyor: boolean;
  surveyorName: string;

  // Map Overlay
  showMapOverlay: boolean;
  mapZoom: number;
  mapShape: 'rounded' | 'square' | 'circle';

  // Logo / Watermark
  showLogo: boolean;
  logoSrc: string | null;
  logoPosition: 'stamp_left' | 'stamp_right' | 'top_right' | 'top_left';

  // Typography & Sizing
  baseFontSize: number;
  timeFontSize: number;
  dateFontSize: number;
  locationFontSize: number;
  coordinatesFontSize: number;
  notesFontSize: number;

  // Appearance
  textColor: string;
  accentColor: string;
  textShadow: boolean;
  backgroundColor: string;
  backgroundOpacity: number; // 0 to 100
  paddingX: number;
  paddingY: number;
  borderRadius: number;

  // Image Transformations
  rotation: number; // 0, 90, 180, 270
  flipHorizontal: boolean;
  brightness: number; // 80 - 150
  contrast: number; // 80 - 150
  saturation: number; // 80 - 150
}

export interface AnalyzedMetadata {
  location?: string;
  coordinates?: string;
  dateTime?: string;
  weather?: string;
  description?: string;
}

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<StampSettings>;
  badge?: string;
  isCustom?: boolean;
}
