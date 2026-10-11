import React, { useRef, useEffect, useState } from 'react';
import { StampSettings, TextPosition, DateFormat, TemplateStyle } from '../types';

interface ImageCanvasProps {
  imageSrc: string | null;
  settings: StampSettings;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

const TILE_SIZE = 256;

const project = (lat: number, lng: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x: x * TILE_SIZE, y: y * TILE_SIZE };
};

const formatCoords = (coordsStr: string, format: 'decimal' | 'dms') => {
  if (!coordsStr) return '';
  const parts = coordsStr.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return coordsStr;
  const [lat, lng] = parts;
  if (format === 'decimal') {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
  }
  const toDms = (deg: number, isLat: boolean) => {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(1);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}°${m}'${s}" ${dir}`;
  };
  return `${toDms(lat, true)}, ${toDms(lng, false)}`;
};

const getFormattedDateParts = (
  isoString: string,
  format: DateFormat,
  includeSeconds: boolean,
  tzLabel: string,
  showTz: boolean
) => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return { time: '', date: isoString, full: isoString };
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const timeStr = includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
  const tzStr = showTz && tzLabel ? ` ${tzLabel}` : '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let dateStr = '';
  const daysId = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthsId = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthsShortId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  switch (format) {
    case DateFormat.LOCAL:
      dateStr = `${day}/${month}/${year}`;
      break;
    case DateFormat.LOCAL_SEC:
      dateStr = `${day}/${month}/${year}`;
      break;
    case DateFormat.FULL_ID:
      dateStr = `${daysId[date.getDay()]}, ${day} ${monthsId[date.getMonth()]} ${year}`;
      break;
    case DateFormat.ISO:
      dateStr = `${year}-${month}-${day}`;
      break;
    case DateFormat.RETRO:
      dateStr = `${month}.${day}.'${String(year).slice(2)}`;
      break;
    case DateFormat.GPS_STANDARD:
      dateStr = `${day}-${monthsShortId[date.getMonth()]}-${year}`;
      break;
    default:
      dateStr = `${day}/${month}/${year}`;
  }

  return {
    time: `${timeStr}${tzStr}`,
    date: dateStr,
    full: `${dateStr} ${timeStr}${tzStr}`,
  };
};

export const ImageCanvas: React.FC<ImageCanvasProps> = ({ imageSrc, settings, onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapCache, setMapCache] = useState<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  // Generate Map Canvas
  useEffect(() => {
    if (!settings.showMapOverlay || !settings.customCoordinates) {
      return;
    }

    const parts = settings.customCoordinates.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

    const lat = parts[0];
    const lng = parts[1];
    const zoom = settings.mapZoom || 15;
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${zoom}`;

    if (mapCache && mapCache.key === cacheKey) return;

    let isMounted = true;

    const renderMapTile = async () => {
      try {
        const width = 360;
        const height = 360;
        const center = project(lat, lng, zoom);
        const startX = center.x - width / 2;
        const startY = center.y - height / 2;

        const minTileX = Math.floor(startX / TILE_SIZE);
        const maxTileX = Math.floor((startX + width) / TILE_SIZE);
        const minTileY = Math.floor(startY / TILE_SIZE);
        const maxTileY = Math.floor((startY + height) / TILE_SIZE);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        // Base background
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, width, height);

        const tilePromises: Promise<void>[] = [];

        for (let tx = minTileX; tx <= maxTileX; tx++) {
          for (let ty = minTileY; ty <= maxTileY; ty++) {
            tilePromises.push(
              new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
                img.onload = () => {
                  const dx = tx * TILE_SIZE - startX;
                  const dy = ty * TILE_SIZE - startY;
                  ctx.drawImage(img, dx, dy);
                  resolve();
                };
                img.onerror = () => resolve();
              })
            );
          }
        }

        await Promise.all(tilePromises);
        if (!isMounted) return;

        // Draw Pin/Marker
        const cx = width / 2;
        const cy = height / 2;

        // Pin shadow
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, 8, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Pin head & body
        ctx.beginPath();
        ctx.arc(cx, cy - 12, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 9, cy - 10);
        ctx.lineTo(cx + 9, cy - 10);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        // White dot inside pin
        ctx.beginPath();
        ctx.arc(cx, cy - 12, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        setMapCache({ key: cacheKey, canvas: offCanvas });
      } catch (err) {
        console.warn('Failed to render static map tiles', err);
      }
    };

    renderMapTile();

    return () => {
      isMounted = false;
    };
  }, [settings.showMapOverlay, settings.customCoordinates, settings.mapZoom]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = imageSrc;

    baseImg.onload = async () => {
      // Handle rotation: 90 or 270 flips width and height
      const isRotated90or270 = settings.rotation === 90 || settings.rotation === 270;
      const targetWidth = isRotated90or270 ? baseImg.height : baseImg.width;
      const targetHeight = isRotated90or270 ? baseImg.width : baseImg.height;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.save();

      // Apply Filter adjustments
      const brightness = settings.brightness ?? 100;
      const contrast = settings.contrast ?? 100;
      const saturation = settings.saturation ?? 100;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

      // Transform context for rotation and flip
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (settings.rotation) {
        ctx.rotate((settings.rotation * Math.PI) / 180);
      }
      if (settings.flipHorizontal) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        baseImg,
        -baseImg.width / 2,
        -baseImg.height / 2,
        baseImg.width,
        baseImg.height
      );

      ctx.restore();
      ctx.filter = 'none'; // reset filter for watermark drawing

      // Scale factor relative to a standard 1200px width/height
      const scaleFactor = Math.max(canvas.width, canvas.height) / 1200;
      const paddingX = (settings.paddingX || 20) * scaleFactor;
      const paddingY = (settings.paddingY || 20) * scaleFactor;
      const borderRadius = (settings.borderRadius || 12) * scaleFactor;

      const dateParts = getFormattedDateParts(
        settings.customDate,
        settings.dateFormat,
        settings.showSeconds,
        settings.timezoneLabel,
        settings.showTimezone
      );

      const timeFS = (settings.timeFontSize || 28) * scaleFactor;
      const dateFS = (settings.dateFontSize || 22) * scaleFactor;
      const locFS = (settings.locationFontSize || 18) * scaleFactor;
      const coordFS = (settings.coordinatesFontSize || 16) * scaleFactor;
      const notesFS = (settings.notesFontSize || 16) * scaleFactor;

      // Font Family
      const isRetro = settings.templateStyle === TemplateStyle.RETRO;
      const fontFamily = isRetro ? '"Courier Prime", "JetBrains Mono", monospace' : '"Inter", system-ui, sans-serif';

      ctx.textBaseline = 'top';

      const applyShadow = () => {
        if (settings.textShadow || isRetro) {
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 4 * scaleFactor;
          ctx.shadowOffsetX = 2 * scaleFactor;
          ctx.shadowOffsetY = 2 * scaleFactor;
        } else {
          ctx.shadowColor = 'transparent';
        }
      };

      const drawBox = (x: number, y: number, w: number, h: number, radius = borderRadius) => {
        if (settings.backgroundOpacity > 0 && settings.templateStyle !== TemplateStyle.MINIMAL) {
          ctx.save();
          const hex = (settings.backgroundColor || '#000000').replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) || 0;
          const g = parseInt(hex.substring(2, 4), 16) || 0;
          const b = parseInt(hex.substring(4, 6), 16) || 0;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${settings.backgroundOpacity / 100})`;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.fill();

          // Border for Modern / GPS styles
          if (settings.templateStyle === TemplateStyle.GPS_SURVEY || settings.templateStyle === TemplateStyle.MODERN) {
            ctx.lineWidth = 1 * scaleFactor;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.stroke();
          }
          ctx.restore();
        }
      };

      // Mini map element
      let mapCanvas = (settings.showMapOverlay && mapCache?.canvas) ? mapCache.canvas : null;
      const mapSize = mapCanvas ? 140 * scaleFactor : 0;
      const mapGap = 16 * scaleFactor;

      const getStartPosition = (boxW: number, boxH: number, margin = 24 * scaleFactor) => {
        let x = margin;
        let y = margin;
        switch (settings.textPosition) {
          case TextPosition.TOP_LEFT:
            x = margin;
            y = margin;
            break;
          case TextPosition.TOP_RIGHT:
            x = canvas.width - boxW - margin;
            y = margin;
            break;
          case TextPosition.TOP_CENTER:
            x = (canvas.width - boxW) / 2;
            y = margin;
            break;
          case TextPosition.BOTTOM_LEFT:
            x = margin;
            y = canvas.height - boxH - margin;
            break;
          case TextPosition.BOTTOM_RIGHT:
            x = canvas.width - boxW - margin;
            y = canvas.height - boxH - margin;
            break;
          case TextPosition.BOTTOM_CENTER:
            x = (canvas.width - boxW) / 2;
            y = canvas.height - boxH - margin;
            break;
          case TextPosition.CENTER:
            x = (canvas.width - boxW) / 2;
            y = (canvas.height - boxH) / 2;
            break;
        }
        return { x: Math.max(margin, Math.min(x, canvas.width - boxW - margin)), y: Math.max(margin, Math.min(y, canvas.height - boxH - margin)) };
      };

      // Optional Logo Image
      let logoImg: HTMLImageElement | null = null;
      if (settings.showLogo && settings.logoSrc) {
        logoImg = await new Promise((res) => {
          const lImg = new Image();
          lImg.onload = () => res(lImg);
          lImg.onerror = () => res(null);
          lImg.src = settings.logoSrc!;
        });
      }

      // Draw depending on style
      if (settings.templateStyle === TemplateStyle.GPS_SURVEY) {
        // GPS SURVEY PRO STYLE (Like popular GPS Map Camera)
        const accentColor = settings.accentColor || '#f59e0b';
        const formattedCoords = formatCoords(settings.customCoordinates, settings.coordFormat);

        // Lines to compute widths
        const rows: { label: string; value: string; size: number; isBold?: boolean }[] = [];

        if (settings.showProjectName && settings.projectName) {
          rows.push({ label: 'PROYEK', value: settings.projectName, size: notesFS * 1.1, isBold: true });
        }
        if (settings.showDate || settings.showTime) {
          const dateVal = `${settings.showDate ? dateParts.date : ''} ${settings.showTime ? dateParts.time : ''}`.trim();
          rows.push({ label: 'WAKTU', value: dateVal, size: dateFS, isBold: true });
        }
        if (settings.showLocation && settings.customLocation) {
          rows.push({ label: 'LOKASI', value: settings.customLocation, size: locFS });
        }
        if (settings.showCoordinates && formattedCoords) {
          rows.push({ label: 'KOORD', value: formattedCoords, size: coordFS });
        }
        if (settings.showAltitude && settings.altitude) {
          rows.push({ label: 'ELEVASI', value: settings.altitude, size: coordFS });
        }
        if (settings.showWeather && settings.weather) {
          rows.push({ label: 'CUACA', value: settings.weather, size: coordFS });
        }
        if (settings.showSurveyor && settings.surveyorName) {
          rows.push({ label: 'PETUGAS', value: settings.surveyorName, size: notesFS });
        }
        if (settings.showNotes && settings.notes) {
          rows.push({ label: 'CATATAN', value: settings.notes, size: notesFS });
        }

        // Measure widths
        let maxLabelWidth = 0;
        let maxValueWidth = 0;
        let totalTextHeight = 0;

        rows.forEach((r) => {
          ctx.font = `600 ${r.size * 0.75}px ${fontFamily}`;
          maxLabelWidth = Math.max(maxLabelWidth, ctx.measureText(r.label).width);

          ctx.font = `${r.isBold ? '700' : '500'} ${r.size}px ${fontFamily}`;
          maxValueWidth = Math.max(maxValueWidth, ctx.measureText(r.value).width);

          totalTextHeight += r.size * 1.45;
        });

        const labelColWidth = maxLabelWidth + 12 * scaleFactor;
        const textContentWidth = Math.min(maxValueWidth + labelColWidth, canvas.width * 0.65);
        const mapBlockWidth = mapCanvas ? mapSize + mapGap : 0;
        const logoSize = logoImg ? 50 * scaleFactor : 0;
        const logoBlockWidth = logoImg ? logoSize + mapGap : 0;

        const contentWidth = textContentWidth + mapBlockWidth + logoBlockWidth;
        const totalContentHeight = Math.max(totalTextHeight, mapSize, logoSize);

        const boxWidth = contentWidth + paddingX * 2;
        const boxHeight = totalContentHeight + paddingY * 2;
        const { x, y } = getStartPosition(boxWidth, boxHeight);

        // Draw Container Box
        drawBox(x, y, boxWidth, boxHeight);

        // Left accent header/strip
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.roundRect(x, y, 6 * scaleFactor, boxHeight, [borderRadius, 0, 0, borderRadius]);
        ctx.fill();

        // Render Text Rows
        let currY = y + paddingY;
        const textStartX = x + paddingX + 8 * scaleFactor;

        rows.forEach((r) => {
          // Label badge
          ctx.fillStyle = accentColor;
          ctx.font = `700 ${r.size * 0.75}px ${fontFamily}`;
          ctx.fillText(r.label, textStartX, currY + 2 * scaleFactor);

          // Value
          ctx.fillStyle = settings.textColor || '#ffffff';
          applyShadow();
          ctx.font = `${r.isBold ? '700' : '500'} ${r.size}px ${fontFamily}`;

          // Word wrap if very long location
          const valX = textStartX + labelColWidth;
          const maxWrapW = textContentWidth - labelColWidth;
          
          if (ctx.measureText(r.value).width > maxWrapW && r.value.includes(' ')) {
            // simple 2-line break
            const words = r.value.split(' ');
            let line1 = '';
            let line2 = '';
            words.forEach(w => {
              if (ctx.measureText(line1 + w + ' ').width < maxWrapW && !line2) {
                line1 += w + ' ';
              } else {
                line2 += w + ' ';
              }
            });
            ctx.fillText(line1.trim(), valX, currY);
            if (line2) {
              currY += r.size * 1.1;
              ctx.fillText(line2.trim(), valX, currY);
            }
          } else {
            ctx.fillText(r.value, valX, currY);
          }

          currY += r.size * 1.45;
        });

        // Draw Map if available
        if (mapCanvas) {
          const mapX = x + paddingX + textContentWidth + 12 * scaleFactor;
          const mapY = y + paddingY + (totalContentHeight - mapSize) / 2;

          ctx.save();
          if (settings.mapShape === 'circle') {
            ctx.beginPath();
            ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
            ctx.clip();
          } else if (settings.mapShape === 'rounded') {
            ctx.beginPath();
            ctx.roundRect(mapX, mapY, mapSize, mapSize, 8 * scaleFactor);
            ctx.clip();
          }

          ctx.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);
          ctx.restore();

          // Border on map
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 2 * scaleFactor;
          if (settings.mapShape === 'circle') {
            ctx.beginPath();
            ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeRect(mapX, mapY, mapSize, mapSize);
          }
        }

        // Draw Logo if available
        if (logoImg) {
          const logoX = x + boxWidth - paddingX - logoSize;
          const logoY = y + paddingY;
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        }

      } else if (settings.templateStyle === TemplateStyle.BOTTOM_BANNER) {
        // FULL BOTTOM BANNER STYLE
        const bannerHeight = Math.max(120 * scaleFactor, mapSize + 24 * scaleFactor);
        const bannerY = canvas.height - bannerHeight;

        // Draw banner background across full width
        ctx.fillStyle = `rgba(15, 23, 42, ${Math.max(0.7, settings.backgroundOpacity / 100)})`;
        ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

        // Top border accent
        ctx.fillStyle = settings.accentColor || '#3b82f6';
        ctx.fillRect(0, bannerY, canvas.width, 3 * scaleFactor);

        const margin = 24 * scaleFactor;
        let leftCursor = margin;

        if (mapCanvas) {
          const mSize = bannerHeight - 24 * scaleFactor;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(leftCursor, bannerY + 12 * scaleFactor, mSize, mSize, 6 * scaleFactor);
          ctx.clip();
          ctx.drawImage(mapCanvas, leftCursor, bannerY + 12 * scaleFactor, mSize, mSize);
          ctx.restore();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 * scaleFactor;
          ctx.strokeRect(leftCursor, bannerY + 12 * scaleFactor, mSize, mSize);
          leftCursor += mSize + 20 * scaleFactor;
        }

        // Text details
        let textY = bannerY + 16 * scaleFactor;
        ctx.fillStyle = settings.textColor || '#ffffff';
        applyShadow();

        if (settings.showProjectName && settings.projectName) {
          ctx.font = `700 ${notesFS * 1.1}px ${fontFamily}`;
          ctx.fillStyle = settings.accentColor || '#38bdf8';
          ctx.fillText(settings.projectName, leftCursor, textY);
          textY += notesFS * 1.3;
        }

        ctx.font = `700 ${timeFS}px ${fontFamily}`;
        ctx.fillStyle = settings.textColor || '#ffffff';
        const timeText = `${settings.showDate ? dateParts.date : ''}  ${settings.showTime ? dateParts.time : ''}`.trim();
        if (timeText) {
          ctx.fillText(timeText, leftCursor, textY);
          textY += timeFS * 1.25;
        }

        ctx.font = `500 ${locFS}px ${fontFamily}`;
        if (settings.showLocation && settings.customLocation) {
          ctx.fillText(`📍 ${settings.customLocation}`, leftCursor, textY);
          textY += locFS * 1.25;
        }

        if (settings.showCoordinates && settings.customCoordinates) {
          ctx.font = `500 ${coordFS}px ${fontFamily}`;
          ctx.fillText(`🌐 ${formatCoords(settings.customCoordinates, settings.coordFormat)}`, leftCursor, textY);
        }

      } else if (settings.templateStyle === TemplateStyle.RETRO) {
        // RETRO DIGICAM 90s STYLE
        // Bright amber/orange/green digital LED display with drop shadow
        const textColor = settings.textColor || '#f97316';
        ctx.fillStyle = textColor;
        applyShadow();

        const lines: { text: string; size: number }[] = [];
        if (settings.showDate && settings.showTime) {
          lines.push({ text: `${dateParts.date}  ${dateParts.time}`, size: timeFS });
        } else if (settings.showDate) {
          lines.push({ text: dateParts.date, size: dateFS });
        } else if (settings.showTime) {
          lines.push({ text: dateParts.time, size: timeFS });
        }

        if (settings.showLocation && settings.customLocation) {
          lines.push({ text: settings.customLocation.toUpperCase(), size: locFS });
        }
        if (settings.showCoordinates && settings.customCoordinates) {
          lines.push({ text: formatCoords(settings.customCoordinates, 'decimal'), size: coordFS });
        }

        let maxW = 0;
        let totalH = 0;
        lines.forEach((l) => {
          ctx.font = `700 ${l.size}px ${fontFamily}`;
          maxW = Math.max(maxW, ctx.measureText(l.text).width);
          totalH += l.size * 1.35;
        });

        const boxW = maxW + paddingX * 2;
        const boxH = totalH + paddingY * 2;
        const { x, y } = getStartPosition(boxW, boxH);

        // Draw subtle box if user wanted opacity > 0
        if (settings.backgroundOpacity > 0) {
          drawBox(x, y, boxW, boxH, 0); // sharp corners for retro
        }

        let curY = y + paddingY;
        lines.forEach((l) => {
          ctx.font = `700 ${l.size}px ${fontFamily}`;
          ctx.fillText(l.text, x + paddingX, curY);
          curY += l.size * 1.35;
        });

      } else {
        // STANDARD, INDUSTRY, MODERN, MINIMAL
        const lines: { text: string; size: number; isBold?: boolean; color?: string; prefix?: string }[] = [];

        if (settings.showProjectName && settings.projectName) {
          lines.push({ text: settings.projectName, size: notesFS * 1.1, isBold: true, color: settings.accentColor });
        }

        if (settings.templateStyle === TemplateStyle.INDUSTRY) {
          if (settings.showTime) {
            lines.push({ text: dateParts.time, size: timeFS, isBold: true });
          }
          if (settings.showDate) {
            lines.push({ text: dateParts.date, size: dateFS, isBold: true });
          }
        } else {
          if (settings.showDate || settings.showTime) {
            const timeVal = `${settings.showDate ? dateParts.date : ''} ${settings.showTime ? dateParts.time : ''}`.trim();
            lines.push({ text: timeVal, size: Math.max(dateFS, timeFS), isBold: true });
          }
        }

        if (settings.showLocation && settings.customLocation) {
          const prefix = settings.templateStyle === TemplateStyle.MODERN ? '📍 ' : '';
          lines.push({ text: `${prefix}${settings.customLocation}`, size: locFS });
        }

        if (settings.showCoordinates && settings.customCoordinates) {
          const formatted = formatCoords(settings.customCoordinates, settings.coordFormat);
          const prefix = settings.templateStyle === TemplateStyle.MODERN ? '🌍 ' : '';
          lines.push({ text: `${prefix}${formatted}`, size: coordFS });
        }

        if (settings.showAltitude && settings.altitude) {
          lines.push({ text: `⛰️ ${settings.altitude}`, size: coordFS });
        }

        if (settings.showWeather && settings.weather) {
          lines.push({ text: `⛅ ${settings.weather}`, size: coordFS });
        }

        if (settings.showNotes && settings.notes) {
          lines.push({ text: `📝 ${settings.notes}`, size: notesFS });
        }

        if (lines.length > 0) {
          let maxTextW = 0;
          let totalTextH = 0;

          lines.forEach((l) => {
            ctx.font = `${l.isBold ? '700' : '500'} ${l.size}px ${fontFamily}`;
            maxTextW = Math.max(maxTextW, ctx.measureText(l.text).width);
            totalTextH += l.size * 1.35;
          });

          const isIndustry = settings.templateStyle === TemplateStyle.INDUSTRY;
          const barW = isIndustry ? 6 * scaleFactor : 0;
          const gap = isIndustry ? 12 * scaleFactor : 0;

          const contentW = maxTextW + barW + gap + (mapCanvas ? mapSize + mapGap : 0);
          const contentH = Math.max(totalTextH, mapSize);

          const boxW = contentW + paddingX * 2;
          const boxH = contentH + paddingY * 2;
          const { x, y } = getStartPosition(boxW, boxH);

          // Draw background
          drawBox(x, y, boxW, boxH);

          // Accent bar for INDUSTRY
          if (isIndustry) {
            ctx.fillStyle = settings.accentColor || '#f59e0b';
            ctx.fillRect(x + paddingX, y + paddingY, barW, contentH);
          }

          // Text render
          let curY = y + paddingY;
          const textX = x + paddingX + barW + gap;

          lines.forEach((l) => {
            ctx.fillStyle = l.color || settings.textColor || '#ffffff';
            ctx.font = `${l.isBold ? '700' : '500'} ${l.size}px ${fontFamily}`;
            applyShadow();
            ctx.fillText(l.text, textX, curY);
            curY += l.size * 1.35;
          });

          // Draw map
          if (mapCanvas) {
            const mapX = textX + maxTextW + mapGap;
            const mapY = y + paddingY + (contentH - mapSize) / 2;

            ctx.save();
            if (settings.mapShape === 'circle') {
              ctx.beginPath();
              ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
              ctx.clip();
            } else {
              ctx.beginPath();
              ctx.roundRect(mapX, mapY, mapSize, mapSize, borderRadius);
              ctx.clip();
            }

            ctx.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);
            ctx.restore();

            ctx.strokeStyle = settings.accentColor || '#ffffff';
            ctx.lineWidth = 1.5 * scaleFactor;
            if (settings.mapShape === 'circle') {
              ctx.beginPath();
              ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.strokeRect(mapX, mapY, mapSize, mapSize);
            }
          }
        }
      }

      onCanvasReady(canvas);
    };
  }, [imageSrc, settings, mapCache, onCanvasReady]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-slate-950/80 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl relative select-none"
    >
      {imageSrc ? (
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all"
        />
      ) : (
        <div className="text-slate-500 flex flex-col items-center p-8 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4 text-slate-400 shadow-inner">
            <svg
              className="w-8 h-8 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-slate-300 font-semibold mb-1 text-base">Pilih atau Ambil Foto</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload foto dari galeri atau gunakan kamera untuk menambahkan stempel timestamp, waktu kustom, dan lokasi GPS akurat.
          </p>
        </div>
      )}
    </div>
  );
};
