import { useEffect, useRef, useState } from "react";
import L from "leaflet";
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

    // Timeout fallback after 4.5s
    setTimeout(() => {
      if (!window.google?.maps) {
        reject(new Error("Google Maps load timeout"));
      }
    }, 4500);
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

  // Leaflet fallback ref
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Layer[]>([]);

  const [useGoogle, setUseGoogle] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");

  // 1. Try loading Google Maps API
  useEffect(() => {
    let active = true;
    loadGoogleMapsApi()
      .then(() => {
        if (active && window.google?.maps) {
          setUseGoogle(true);
        }
      })
      .catch((err) => {
        console.warn("Using Leaflet map engine:", err.message);
        if (active) {
          setLoadError(err.message || "Failed to load Google Maps");
          setUseGoogle(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize Google Map instance if loaded
  useEffect(() => {
    if (!useGoogle || !containerRef.current || !window.google?.maps) return;

    if (!mapRef.current) {
      // Destroy any leaflet map before initializing google map
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const map = new window.google.maps.Map(containerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        mapTypeId: mapType,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
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
  }, [useGoogle, zoom, mapType, onMapClick]);

  // Toggle map type
  const toggleMapType = () => {
    const next = mapType === "roadmap" ? "hybrid" : "roadmap";
    setMapType(next);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(next);
    }
  };

  // 3. Render Google Maps Markers & InfoWindows
  useEffect(() => {
    if (!useGoogle || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // A. Customer Location Marker
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
            <div style="font-weight: 700; color: #b45309;">☀️ ${customerLocation?.label || "Rooftop Location"}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              Lat: ${cPos.lat.toFixed(4)}, Lng: ${cPos.lng.toFixed(4)}
            </div>
          </div>
        `);
        infoWindow.open(map, custMarker);
      });

      markersRef.current.push(custMarker);
    }

    // B. Editable Pin Marker (For Admin marking / updating staff location)
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
      map.panTo({ lat: editablePin.lat, lng: editablePin.lng });
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
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">📍 ${tech.location_name}</div>
            <div style="font-size: 10.5px; color: #166534; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
              ${tech.specializations.slice(0, 2).join(", ")}
            </div>
            <div style="font-size: 11px; color: #334155; margin-top: 4px;">
              📞 <a href="tel:${tech.phone.replace(/\s/g, "")}" style="color: #0284c7; text-decoration: none;">${tech.phone}</a>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
              ${tech.experience_years} yrs exp · ${tech.working_hours}
            </div>
          </div>
        `);
        infoWindow.open(map, techMarker);
      });

      markersRef.current.push(techMarker);
    });

    if (selected) {
      map.panTo({ lat: selected.lat, lng: selected.lng });
    } else if (center && !editablePin) {
      map.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [useGoogle, technicians, selected, customerLocation, center, editablePin, onSelect, onMapClick]);

  // 4. LEAFLET FALLBACK ENGINE (Guarantees map NEVER fails)
  useEffect(() => {
    if (useGoogle || !containerRef.current) return;

    if (!leafletMapRef.current) {
      const lMap = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([center.lat, center.lng], zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(lMap);

      if (onMapClick) {
        lMap.on("click", (e: L.LeafletMouseEvent) => {
          onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      leafletMapRef.current = lMap;
    }

    const lMap = leafletMapRef.current;
    if (!lMap) return;

    // Clear old layers
    leafletMarkersRef.current.forEach((m) => lMap.removeLayer(m));
    leafletMarkersRef.current = [];

    // A. Center / Customer marker
    const cPos = customerLocation || center;
    const centerMarker = L.circleMarker([cPos.lat, cPos.lng], {
      radius: 9,
      color: "#f59e0b",
      fillColor: "#fbbf24",
      fillOpacity: 0.9,
      weight: 3,
    }).addTo(lMap);
    centerMarker.bindPopup(`<b>☀️ ${customerLocation?.label || "Rooftop Location"}</b><br>Lat: ${cPos.lat.toFixed(4)}, Lng: ${cPos.lng.toFixed(4)}`);
    leafletMarkersRef.current.push(centerMarker);

    // B. Editable Pin marker
    if (editablePin) {
      const editPin = L.circleMarker([editablePin.lat, editablePin.lng], {
        radius: 12,
        color: "#ffffff",
        fillColor: "#ef4444",
        fillOpacity: 1,
        weight: 3,
      }).addTo(lMap);
      editPin.bindPopup(`<b>📍 ${editablePin.label || "Target Location"}</b><br>Lat: ${editablePin.lat.toFixed(4)}, Lng: ${editablePin.lng.toFixed(4)}`);
      leafletMarkersRef.current.push(editPin);
      lMap.panTo([editablePin.lat, editablePin.lng]);
    }

    // C. Staff markers
    technicians.forEach((tech) => {
      const isSel = selected?.id === tech.id;
      const techPin = L.circleMarker([tech.lat, tech.lng], {
        radius: isSel ? 12 : 9,
        color: isSel ? "#fbbf24" : "#ffffff",
        fillColor: tech.is_active ? "#059669" : "#64748b",
        fillOpacity: 1,
        weight: isSel ? 3 : 2,
      }).addTo(lMap);

      techPin.bindPopup(`
        <div style="font-size: 12px; font-family: system-ui, sans-serif;">
          <b style="color: #065f46;">${tech.name}</b> · ★ ${tech.rating}<br>
          📍 ${tech.location_name}<br>
          📞 ${tech.phone}<br>
          <small>${tech.specializations.slice(0, 2).join(", ")}</small>
        </div>
      `);

      techPin.on("click", () => {
        if (onSelect) onSelect(tech);
      });

      leafletMarkersRef.current.push(techPin);
    });

    if (selected) {
      lMap.panTo([selected.lat, selected.lng]);
    } else if (center && !editablePin) {
      lMap.panTo([center.lat, center.lng]);
    }

    setTimeout(() => lMap.invalidateSize(), 80);
  }, [useGoogle, center, zoom, technicians, selected, customerLocation, editablePin, onSelect, onMapClick]);

  // Center reset helper
  const handleResetCenter = () => {
    if (useGoogle && mapRef.current) {
      mapRef.current.panTo({ lat: center.lat, lng: center.lng });
      mapRef.current.setZoom(zoom);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setView([center.lat, center.lng], zoom);
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm ${className}`}
      style={{ height }}
    >
      {/* Map Canvas */}
      <div ref={containerRef} className="h-full w-full" style={{ zIndex: 1 }} />

      {/* Floating Map Controls & Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {useGoogle ? "Google Maps Live" : "Interactive Map (Live)"}
        </span>

        {useGoogle && (
          <button
            type="button"
            onClick={toggleMapType}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition backdrop-blur cursor-pointer"
          >
            <Layers className="h-3 w-3 text-brand-700" />
            {mapType === "roadmap" ? "Satellite" : "Map"}
          </button>
        )}

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
          💡 Click anywhere on the map to set / update coordinates
        </div>
      )}
    </div>
  );
}
