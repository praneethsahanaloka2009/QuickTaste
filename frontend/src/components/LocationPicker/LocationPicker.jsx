import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./LocationPicker.css";

maplibregl.setWorkerUrl(workerUrl);

const DEFAULT_LOCATION = {
    latitude: 7.2083,
    longitude: 79.8358
}

// Development map style.
// Use a production-approved tile provider before launch.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

const ROAD_SHIELD_LAYERS = new Set(["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]);

const loadMapStyle = async () => {
    const response = await fetch(MAP_STYLE_URL);

    if(!response.ok){
        throw new Error("Unable to load map style.");
    }

    const style = await response.json();

    // Remove only problematic road-shield layers.
    // Roads themselves remain visible.
    style.layers = style.layers.filter(
        (layer) => !ROAD_SHIELD_LAYERS.has(layer.id)
    );

    return style;
}

const LocationPicker = ({ value, onChange }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onChangeRef = useRef(onChange);

    const [loadingLocation, setLoadingLocation] = useState(false);
    const [mapError, setMapError] = useState("");
    const [mapView, setMapView] = useState("2D");

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if(!mapContainerRef.current || mapRef.current){
            return;
        }

        const initialLatitude = value?.latitude ?? DEFAULT_LOCATION.latitude;

        const initialLongitude = value?.longitude ?? DEFAULT_LOCATION.longitude;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: {
                version: 8,
                sources: {},
                layers: []
            },
            center: [initialLongitude, initialLatitude],
            zoom: value ? 17 : 11,
            pitch: 0,
            bearing: 0
        });

        loadMapStyle().then((style) => {
            if(mapRef.current === map){
                map.setStyle(style);
            }
        }).catch((error) => {
            console.error("QuickTaste map style error:", error);

            if(mapRef.current === map){
                setMapError("Map could not load. Please check your connection.");
            }
        });

        mapRef.current = map;

        map.on("styleimagemissing", (event) => {
            const id = event.id;

            if(map.hasImage(id)){
                return;
            }

            const size = 16;
            const data = new Uint8Array(size * size * 4);

            // Transparent placeholder
            map.addImage(id, {
                width: size,
                height: size,
                data
            });
        });

        map.addControl(
            new maplibregl.NavigationControl(),
            "top-right"
        );

        // Show 2D building outlines when building data is available
        map.on("style.load", () => {
            if(!map.getSource("openmaptiles")){
                return;
            }

            const style = map.getStyle();

            if(!map.getLayer("quicktaste-3d-buildings")){
                const firstSymbolLayer = style.layers.find(
                    (layer) => layer.type === "symbol"
                );

                map.addLayer(
                    {
                        id: "quicktaste-3d-buildings",
                        type: "fill-extrusion",
                        source: "openmaptiles",
                        "source-layer": "building",
                        minzoom: 15,
                        layout: {
                            visibility: "none"
                        },
                        paint: {
                            "fill-extrusion-color": "#b8c8bc",
                            "fill-extrusion-height": [
                                "coalesce", ["to-number", ["get", "render_height"], null], ["to-number", ["get", "height"], null], 8
                            ],
                            "fill-extrusion-base": 0,
                            "fill-extrusion-opacity": 0.85
                        }
                    },
                    firstSymbolLayer?.id
                );
            }
            console.log("QuickTaste 3D Buildings ready");
        });

        const marker = new maplibregl.Marker({color: "#065d23", draggable: true}).setLngLat([initialLongitude, initialLatitude]).addTo(map);

        markerRef.current = marker;

        const updateLocation = (longitude, latitude) => {
            onChangeRef.current?.({
                latitude,
                longitude
            });
        };

        marker.on("dragend", () => {
            const position = marker.getLngLat();

            updateLocation(position.lng, position.lat);
        });

        map.on("click", (event) =>{
            const { lng, lat } = event.lngLat;

            marker.setLngLat([lng, lat]);
            updateLocation(lng, lat);
        });

        map.on("error", (event) => {
            console.error("QuickTaste Map Error:", event.error);
        })

        return () => {
            marker.remove();
            map.remove();

            markerRef.current = null;
            mapRef.current = null;
        };
    }, []);

    const useCurrentLocation = () => {
        if(!navigator.geolocation){
            setMapError("Your browser does not support GPS.");
            return;
        }

        setLoadingLocation(true);
        setMapError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: 17
                });

                markerRef.current?.setLngLat([longitude, latitude]);

                onChangeRef.current?.({latitude, longitude});

                setLoadingLocation(false);
            },
            () => {
                setMapError(
                    "Unable to get your location. Select your delivery location manually."
                );

                setLoadingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    };

    const changeMapView = (view) => {
        const map = mapRef.current;

        if(!map){
            return;
        }

        setMapView(view);

        const is3D = view === "3D";

        map.easeTo({
            pitch: is3D ? 55 : 0,
            bearing: is3D ? -15 : 0,
            duration: 800
        });

        if(map.getLayer("quicktaste-3d-buildings")){
            map.setLayoutProperty(
                "quicktaste-3d-buildings",
                "visibility",
                is3D ? "visible" : "none"
            );
        }

        const style = map.getStyle();

        style.layers.forEach((layer) => {
            if(layer.type === "fill" && (layer.id.toLowerCase().includes("building") || layer["source-layer"] === "building")){
                map.setLayoutProperty(
                    layer.id,
                    "visibility",
                    is3D ? "none" : "visible"
                );
            }
        });
    };

    return (
        <div className="location-picker">
            <div className="location-picker-header">
                <h3>Select Delivery Location</h3>

                <p>Select your delivery address on the map or use your current location.</p>
            </div>

            <button type="button" className="location-gps-button" onClick={useCurrentLocation} disabled={loadingLocation}>
                {loadingLocation ? "Finding your location..." : "Use My Current Location"}
            </button>

            <div className="location-map-wrapper">
                <div className="location-map-view-toggle">
                    <button type="button" className={mapView === "2D" ? "active" : ""} onClick={() => changeMapView("2D")}>
                        2D
                    </button>

                    <button type="button" className={mapView === "3D" ? "active" : ""} onClick={() => changeMapView("3D")}>
                        3D
                    </button>
                </div>

                <div ref={mapContainerRef} className="location-picker-map"/>
            </div>

            <p className="location-picker-hint">
                Click on the map or drag the green marker to your delivery entrance.
            </p>

            {value ? (
                <div className="location-picker-selected">
                    <span>Delivery location selected</span>

                    <small>
                        {value.latitude.toFixed(6)},{" "}
                        {value.longitude.toFixed(6)}
                    </small>
                </div>
            ) : (
                <p className="location-picker-warning">
                    Please select your delivery location.
                </p>
            )}

            {mapError && (
                <p className="location-picker-error">
                    {mapError}
                </p>
            )}
        </div>
    );
};

export default LocationPicker;