import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Compass, Layers, CheckCircle, AlertCircle, Phone, Star, Wrench } from "lucide-react";
import type { TechnicianProfile } from "@/types";

declare global {
  interface Window {
    google?: any;
    __google_maps_loading__?: Promise<void>;
  }
}

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "AIzaSyCxPFN5_lhCWV9yNULH93-WF34NgIgzac8";

/**
 * Singleton script loader for Google Maps API
 */
function loadGoogleMapsApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__google_maps_loading__) return window.__google_maps_loading__;

  window.__google_maps_loading__ = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps SDK")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Network or API key error loading Google Maps"));
    document.head.appendChild(script);
  });

  return window.__google_maps_loading__;
}

export interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  technicians?: TechnicianProfile[];
  selected?: TechnicianProfile | null;
  onSelect?: (tech: TechnicianProfile) => void;
  customerLocation?: { lat: number; lng: number; label?: string } | null;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  editablePin?: { lat: number; lng: number; label?: string } | null;
  height?: string;
  className?: string;
}

export function GoogleMapView({
  center,
  zoom = 12,
  technicians = [],
  selected = null,
  onSelect,
  customerLocation,
  onMapClick,
  editablePin,
  height = "520px",
  className = "",
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");

  // 1. Load Google Maps API
  useEffect(() => {
    let active = true;
    loadGoogleMapsApi()
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch((err) => {
        console.warn("Google Maps load fallback:", err.message);
        if (active) setLoadError(err.message || "Failed to load Google Maps");
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize Google Map instance
  useEffect(() => {
    if (!loaded || !containerRef.current || !window.google?.maps) return;

    if (!mapRef.current) {
      const map = new window.google.maps.Map(containerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        mapTypeId: mapType,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      infoWindowRef.current = new window.google.maps.InfoWindow();

      if (onMapClick) {
        map.addListener("click", (e: any) => {
          if (e.latLng) {
            onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });
      }

      mapRef.current = map;
    }
  }, [loaded, zoom, mapType, onMapClick]);

  // Toggle map type
  const toggleMapType = () => {
    const next = mapType === "roadmap" ? "hybrid" : "roadmap";
    setMapType(next);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(next);
    }
  };

  // 3. Render Markers & InfoWindows
  useEffect(() => {
    if (!loaded || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // A. Customer Location Marker (Gold / Emerald Sun badge)
    if (customerLocation || center) {
      const cPos = customerLocation || center;
      const custMarker = new window.google.maps.Marker({
        position: { lat: cPos.lat, lng: cPos.lng },
        map,
        title: customerLocation?.label || "Customer Rooftop Location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
        zIndex: 999,
      });

      custMarker.addListener("click", () => {
        infoWindow.setContent(`
          <div style="padding: 6px; font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a;">
            <div style="font-weight: 700; color: #b45309; display: flex; align-items: center; gap: 4px;">
              ☀️ ${customerLocation?.label || "Customer Rooftop"}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              Lat: ${cPos.lat.toFixed(4)}, Lng: ${cPos.lng.toFixed(4)}
            </div>
          </div>
        `);
        infoWindow.open(map, custMarker);
      });

      markersRef.current.push(custMarker);
    }

    // B. Editable Pin Marker (For Manager marking / updating staff location)
    if (editablePin) {
      const editMarker = new window.google.maps.Marker({
        position: { lat: editablePin.lat, lng: editablePin.lng },
        map,
        title: editablePin.label || "Marked Location Target",
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.8,
          anchor: new window.google.maps.Point(12, 22),
        },
        zIndex: 1000,
      });

      if (onMapClick) {
        editMarker.addListener("dragend", (e: any) => {
          if (e.latLng) {
            onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });
      }

      markersRef.current.push(editMarker);
    }

    // C. Staff / Technician Markers
    technicians.forEach((tech) => {
      const isSel = selected?.id === tech.id;
      const techMarker = new window.google.maps.Marker({
        position: { lat: tech.lat, lng: tech.lng },
        map,
        title: tech.name,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: isSel ? "#10b981" : tech.is_active ? "#059669" : "#64748b",
          fillOpacity: 1,
          strokeColor: isSel ? "#fbbf24" : "#ffffff",
          strokeWeight: isSel ? 3 : 1.5,
          scale: isSel ? 1.9 : 1.5,
          anchor: new window.google.maps.Point(12, 22),
        },
        zIndex: isSel ? 900 : 500,
      });

      techMarker.addListener("click", () => {
        if (onSelect) onSelect(tech);

        infoWindow.setContent(`
          <div style="padding: 8px; font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a; max-width: 220px;">
            <div style="font-weight: 700; font-size: 13px; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
              <span>${tech.name}</span>
              <span style="color: #b45309; font-size: 11px;">★ ${tech.rating}</span>
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              📍 ${tech.location_name}
            </div>
            <div style="font-size: 10.5px; color: #166534; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
              ${tech.specializations.slice(0, 2).join(", ")}
            </div>
            <div style="font-size: 11px; color: #334155; margin-top: 4px;">
              📞 <a href="tel:${tech.phone.replace(/\s/g, "")}" style="color: #0284c7; text-decoration: none;">${tech.phone}</a>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
              Experience: ${tech.experience_years} years · ${tech.working_hours}
            </div>
          </div>
        `);
        infoWindow.open(map, techMarker);
      });

      markersRef.current.push(techMarker);
    });

    // Center map on selected technician if one was clicked
    if (selected) {
      map.panTo({ lat: selected.lat, lng: selected.lng });
    }
  }, [loaded, technicians, selected, customerLocation, center, editablePin, onSelect, onMapClick]);

  // Center reset helper
  const handleResetCenter = () => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: center.lat, lng: center.lng });
      mapRef.current.setZoom(zoom);
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm ${className}`}
      style={{ height }}
    >
      {/* Google Maps Container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Floating Map Controls & Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Google Maps Live
        </span>

        <button
          type="button"
          onClick={toggleMapType}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition backdrop-blur cursor-pointer"
        >
          <Layers className="h-3 w-3 text-brand-700" />
          {mapType === "roadmap" ? "Satellite" : "Map"}
        </button>

        <button
          type="button"
          onClick={handleResetCenter}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition backdrop-blur cursor-pointer"
        >
          <Compass className="h-3 w-3 text-brand-700" />
          Center
        </button>
      </div>

      {onMapClick && (
        <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-brand-200 bg-brand-50/95 px-3 py-1.5 text-[11px] font-medium text-brand-900 shadow-sm backdrop-blur">
          💡 Click anywhere on the map or drag the pin to update coordinates
        </div>
      )}

      {/* Fallback Banner if network blocks Google Maps CDN */}
      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-600 mb-2" />
          <p className="font-semibold text-slate-800 text-sm">Google Maps API Offline / Sandboxed</p>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Using Google Maps API key <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px] font-mono">{GOOGLE_MAPS_API_KEY.slice(0, 10)}...</code>.
            Ensure internet connectivity is enabled to render live Google tiles.
          </p>
        </div>
      )}
    </div>
  );
}
