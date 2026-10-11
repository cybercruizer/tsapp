import React, { useRef, useEffect, useState } from 'react';
import { StampSettings, TextPosition, DateFormat, TemplateStyle } from '../types';

interface ImageCanvasProps {
  imageSrc: string | null;
  settings: StampSettings;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

// Math for OSM Tile Projection (Web Mercator)
const TILE_SIZE = 256;

const project = (lat: number, lng: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const lat_rad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI)) / 2;
  return { x: x * TILE_SIZE, y: y * TILE_SIZE };
};

export const ImageCanvas: React.FC<ImageCanvasProps> = ({ imageSrc, settings, onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setContainerDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getFormattedDateParts = (isoString: string, format: DateFormat) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { time: '', date: isoString, full: isoString };

    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let dateStr = '';
    if (format === DateFormat.ISO) {
      dateStr = date.toISOString().slice(0, 10);
    } else if (format === DateFormat.LOCAL) {
      dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } else {
      dateStr = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    return {
      time: timeStr,
      date: dateStr,
      full: `${dateStr} ${timeStr}`
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // --- Timestamp Logic ---
      
      const scaleFactor = Math.max(img.width, img.height) / 1000;
      const paddingX = settings.paddingX * scaleFactor;
      const paddingY = settings.paddingY * scaleFactor;
      const borderRadius = settings.borderRadius * scaleFactor;
      const dateParts = getFormattedDateParts(settings.customDate, settings.dateFormat);

      // Font size scalers
      const timeFS = settings.timeFontSize * scaleFactor;
      const dateFS = settings.dateFontSize * scaleFactor;
      const locFS = settings.locationFontSize * scaleFactor;
      const coordFS = settings.coordinatesFontSize * scaleFactor;

      // Common Paint Setup
      ctx.textBaseline = 'top';
      const applyShadow = () => {
        if (settings.textShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4 * scaleFactor;
          ctx.shadowOffsetX = 2 * scaleFactor;
          ctx.shadowOffsetY = 2 * scaleFactor;
        } else {
          ctx.shadowColor = 'transparent';
        }
      };

      // Helper to draw background box
      const drawBox = (x: number, y: number, w: number, h: number) => {
        if (settings.backgroundOpacity > 0) {
          ctx.save();
          const hex = settings.backgroundColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${settings.backgroundOpacity / 100})`;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, borderRadius);
          ctx.fill();
          ctx.restore();
        }
      };

      // Load Map if needed
      let mapImg: HTMLCanvasElement | null = null;
      if (settings.showMapOverlay && settings.customCoordinates) {
        const parts = settings.customCoordinates.split(',').map(s => s.trim());
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                // Generate OSM Static Map manually by stitching tiles
                try {
                    const zoom = 15;
                    const width = 400; // Internal resolution for the map image
                    const height = 400;
                    
                    const centerPoint = project(lat, lng, zoom);
                    const startX = centerPoint.x - width / 2;
                    const startY = centerPoint.y - height / 2;

                    const minTileX = Math.floor(startX / TILE_SIZE);
                    const maxTileX = Math.floor((startX + width) / TILE_SIZE);
                    const minTileY = Math.floor(startY / TILE_SIZE);
                    const maxTileY = Math.floor((startY + height) / TILE_SIZE);

                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = width;
                    offCanvas.height = height;
                    const offCtx = offCanvas.getContext('2d');
                    
                    if (offCtx) {
                        // Fill background in case tiles load slowly
                        offCtx.fillStyle = '#e5e7eb';
                        offCtx.fillRect(0,0, width, height);

                        const promises = [];
                        for (let tx = minTileX; tx <= maxTileX; tx++) {
                            for (let ty = minTileY; ty <= maxTileY; ty++) {
                                promises.push(new Promise<void>((resolve) => {
                                    const tileImg = new Image();
                                    tileImg.crossOrigin = "anonymous";
                                    // Use standard OSM tile server
                                    tileImg.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
                                    tileImg.onload = () => {
                                        const drawX = (tx * TILE_SIZE) - startX;
                                        const drawY = (ty * TILE_SIZE) - startY;
                                        offCtx.drawImage(tileImg, drawX, drawY);
                                        resolve();
                                    };
                                    tileImg.onerror = () => {
                                        // resolve anyway to not block
                                        resolve();
                                    };
                                }));
                            }
                        }
                        await Promise.all(promises);

                        // Draw Pin/Marker
                        const cx = width / 2;
                        const cy = height / 2;
                        
                        // Pin Head
                        offCtx.beginPath();
                        offCtx.arc(cx, cy - 10, 10, 0, Math.PI * 2);
                        offCtx.fillStyle = '#ef4444'; // Red-500
                        offCtx.fill();
                        offCtx.lineWidth = 2;
                        offCtx.strokeStyle = '#ffffff';
                        offCtx.stroke();
                        
                        // Pin Point
                        offCtx.beginPath();
                        offCtx.moveTo(cx - 10, cy - 12);
                        offCtx.lineTo(cx + 10, cy - 12);
                        offCtx.lineTo(cx, cy + 10);
                        offCtx.closePath();
                        offCtx.fillStyle = '#ef4444';
                        offCtx.fill();

                        // Inner dot
                        offCtx.beginPath();
                        offCtx.arc(cx, cy - 10, 3, 0, Math.PI * 2);
                        offCtx.fillStyle = '#ffffff';
                        offCtx.fill();
                        
                        mapImg = offCanvas;
                    }
                } catch (e) {
                    console.warn("Could not generate OSM map", e);
                }
            }
        }
      }

      // Helper to calculate start position based on box size
      const getStartPosition = (boxW: number, boxH: number, margin = 20 * scaleFactor) => {
        let x = 0, y = 0;
        switch (settings.textPosition) {
          case TextPosition.TOP_LEFT: x = margin; y = margin; break;
          case TextPosition.TOP_RIGHT: x = canvas.width - boxW - margin; y = margin; break;
          case TextPosition.BOTTOM_LEFT: x = margin; y = canvas.height - boxH - margin; break;
          case TextPosition.BOTTOM_RIGHT: x = canvas.width - boxW - margin; y = canvas.height - boxH - margin; break;
          case TextPosition.CENTER: x = (canvas.width - boxW) / 2; y = (canvas.height - boxH) / 2; break;
          case TextPosition.BOTTOM_CENTER: x = (canvas.width - boxW) / 2; y = canvas.height - boxH - margin; break;
        }
        return { x, y };
      };

      // --- RENDER STYLES ---

      // Map sizing
      const mapSize = mapImg ? 120 * scaleFactor : 0;
      const mapGap = 16 * scaleFactor;

      if (settings.templateStyle === TemplateStyle.INDUSTRY) {
        // INDUSTRY STYLE: Vertical Bar
        
        ctx.font = `bold ${timeFS}px Inter, sans-serif`;
        const timeWidth = ctx.measureText(dateParts.time).width;
        
        ctx.font = `bold ${dateFS}px Inter, sans-serif`;
        const dateWidth = ctx.measureText(dateParts.date).width;
        
        ctx.font = `${locFS}px Inter, sans-serif`;
        const locWidth = settings.showLocation ? ctx.measureText(settings.customLocation).width : 0;
        
        ctx.font = `${coordFS}px Inter, sans-serif`;
        const coordWidth = settings.showCoordinates ? ctx.measureText(settings.customCoordinates).width : 0;

        const maxTextWidth = Math.max(timeWidth, dateWidth, locWidth, coordWidth);
        const barWidth = 6 * scaleFactor;
        const gap = 12 * scaleFactor;
        
        // Calculate Height
        let contentHeight = 0;
        const timeHeight = timeFS * 1.1; // Line height
        const dateHeight = dateFS * 1.2;
        const locHeight = locFS * 1.3;
        const coordHeight = coordFS * 1.3;

        if (settings.showDate) contentHeight += timeHeight + dateHeight;
        if (settings.showLocation && settings.customLocation) contentHeight += locHeight;
        if (settings.showCoordinates && settings.customCoordinates) contentHeight += coordHeight;

        const totalTextHeight = Math.max(contentHeight, mapSize > 0 ? mapSize : 0);

        // Apply strict sizes to box
        const contentWidth = maxTextWidth + barWidth + gap + (mapSize > 0 ? mapSize + mapGap : 0);
        const boxWidth = contentWidth + (paddingX * 2);
        const boxHeight = totalTextHeight + (paddingY * 2);
        const { x, y } = getStartPosition(boxWidth, boxHeight);

        // Draw Box
        drawBox(x, y, boxWidth, boxHeight);

        // Draw Vertical Bar (Accent)
        ctx.save();
        ctx.fillStyle = '#FBBF24'; // Amber-400
        // Center the bar vertically within the padding
        ctx.fillRect(x + paddingX, y + paddingY, barWidth, totalTextHeight);
        ctx.restore();

        // Draw Text
        ctx.fillStyle = settings.textColor;
        applyShadow();
        
        let currentY = y + paddingY;
        const textX = x + paddingX + barWidth + gap;

        if (settings.showDate) {
          // Time
          ctx.font = `bold ${timeFS}px Inter, sans-serif`;
          ctx.fillText(dateParts.time, textX, currentY);
          currentY += timeHeight;
          
          // Date
          ctx.font = `bold ${dateFS}px Inter, sans-serif`;
          ctx.fillText(dateParts.date, textX, currentY);
          currentY += dateHeight;
        }

        if (settings.showLocation && settings.customLocation) {
          ctx.font = `${locFS}px Inter, sans-serif`;
          ctx.fillText(settings.customLocation, textX, currentY);
          currentY += locHeight;
        }
        if (settings.showCoordinates && settings.customCoordinates) {
           ctx.font = `${coordFS}px Inter, sans-serif`;
           ctx.fillText(settings.customCoordinates, textX, currentY);
        }

        // Draw Map
        if (mapImg) {
            ctx.drawImage(mapImg, textX + maxTextWidth + mapGap, y + paddingY, mapSize, mapSize);
            // Draw border around map
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2 * scaleFactor;
            ctx.strokeRect(textX + maxTextWidth + mapGap, y + paddingY, mapSize, mapSize);
        }

      } else {
        // STANDARD LAYOUTS (Simple, Modern, Retro)
        
        // Define Font Family
        let fontFamily = 'Inter, sans-serif';
        if (settings.templateStyle === TemplateStyle.RETRO) fontFamily = 'Courier Prime, Courier New, monospace';

        const lines = [];
        if (settings.showDate) {
             if (settings.templateStyle === TemplateStyle.MODERN) {
                 lines.push({ text: `📅 ${dateParts.date}`, size: dateFS });
                 lines.push({ text: `🕒 ${dateParts.time}`, size: timeFS });
             } else if (settings.templateStyle === TemplateStyle.SIMPLE) {
                 lines.push({ text: dateParts.full, size: Math.max(dateFS, timeFS) });
             } else {
                 lines.push({ text: dateParts.full.toUpperCase(), size: dateFS });
             }
        }
        
        if (settings.showLocation && settings.customLocation) {
             const prefix = settings.templateStyle === TemplateStyle.MODERN ? '📍 ' : '';
             const txt = settings.templateStyle === TemplateStyle.RETRO ? settings.customLocation.toUpperCase() : settings.customLocation;
             lines.push({ text: prefix + txt, size: locFS });
        }
        
        if (settings.showCoordinates && settings.customCoordinates) {
             const prefix = settings.templateStyle === TemplateStyle.MODERN ? '🌍 ' : '';
             lines.push({ text: prefix + settings.customCoordinates, size: coordFS });
        }

        if (lines.length > 0) {
          let maxWidth = 0;
          let totalHeight = 0;

          lines.forEach(line => {
             ctx.font = `bold ${line.size}px ${fontFamily}`;
             maxWidth = Math.max(maxWidth, ctx.measureText(line.text).width);
             totalHeight += line.size * 1.3;
          });
          
          // Adjust for map
          const contentWidth = maxWidth + (mapSize > 0 ? mapGap + mapSize : 0);
          const contentHeight = Math.max(totalHeight, mapSize);

          const boxWidth = contentWidth + (paddingX * 2);
          const boxHeight = contentHeight + (paddingY * 2);
          const { x, y } = getStartPosition(boxWidth, boxHeight);

          drawBox(x, y, boxWidth, boxHeight);

          ctx.fillStyle = settings.textColor;
          applyShadow();

          let currentY = y + paddingY;
          
          // Render Map Left aligned if Modern, Right aligned otherwise? 
          // Let's keep it simple: Map on Right of text
          
          lines.forEach((line) => {
             ctx.font = `bold ${line.size}px ${fontFamily}`;
             ctx.fillText(line.text, x + paddingX, currentY);
             currentY += line.size * 1.3;
          });

          if (mapImg) {
              const mapX = x + paddingX + maxWidth + mapGap;
              // Center vertically relative to box content
              const mapY = y + paddingY + (contentHeight - mapSize) / 2;
              
              ctx.drawImage(mapImg, mapX, mapY, mapSize, mapSize);
              ctx.strokeStyle = settings.textColor;
              ctx.lineWidth = 1 * scaleFactor;
              ctx.strokeRect(mapX, mapY, mapSize, mapSize);
          }
        }
      }

      onCanvasReady(canvas);
    };

  }, [imageSrc, settings, onCanvasReady]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-inner">
      {imageSrc ? (
        <canvas 
          ref={canvasRef} 
          className="max-w-full max-h-full object-contain shadow-2xl"
        />
      ) : (
        <div className="text-slate-500 flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Upload a photo to start editing</p>
        </div>
      )}
    </div>
  );
};
