export enum TextPosition {
  TOP_LEFT = 'Top Left',
  TOP_RIGHT = 'Top Right',
  BOTTOM_LEFT = 'Bottom Left',
  BOTTOM_RIGHT = 'Bottom Right',
  CENTER = 'Center',
  BOTTOM_CENTER = 'Bottom Center'
}

export enum DateFormat {
  ISO = 'YYYY-MM-DD HH:mm',
  LOCAL = 'DD/MM/YYYY HH:mm',
  FULL = 'Weekday, DD Month YYYY'
}

export enum TemplateStyle {
  SIMPLE = 'Simple',
  INDUSTRY = 'Industry',
  MODERN = 'Modern',
  RETRO = 'Retro'
}

export interface StampSettings {
  templateStyle: TemplateStyle;
  textPosition: TextPosition;
  
  // Content
  showDate: boolean;
  customDate: string; // ISO string
  dateFormat: DateFormat;
  showLocation: boolean;
  customLocation: string;
  showCoordinates: boolean;
  customCoordinates: string;
  showMapOverlay: boolean;

  // Font Sizes (Specific)
  timeFontSize: number;
  dateFontSize: number;
  locationFontSize: number;
  coordinatesFontSize: number;

  // Appearance
  textColor: string;
  textShadow: boolean;
  backgroundColor: string;
  backgroundOpacity: number; // 0 to 100
  paddingX: number;
  paddingY: number;
  borderRadius: number;
}

export interface AnalyzedMetadata {
  location?: string;
  dateTime?: string;
  coordinates?: string;
  description?: string;
}