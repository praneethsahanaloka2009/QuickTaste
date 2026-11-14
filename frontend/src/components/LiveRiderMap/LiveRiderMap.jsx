import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Radio, WifiOff } from "lucide-react";
import "./LiveRiderMap.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4911";

const isValidPosition = (latitude, longitude) => {
    return (
        typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );
};

const getDestination = (location) => {
    if(location && isValidPosition(location.latitude, location.longitude)){
        return {
            latitude: location.latitude,
            longitude: location.longitude
        };
    }

    return null;
};

function LiveRiderMap({ orderId, token, deliveryLocation }) {
    const mapElementRef = useRef(null);
    const mapRef = useRef(null);
    const riderMarkerRef = useRef(null);
    const destinationMarkerRef = useRef(null);

    const [riderPosition, setRiderPosition] = useState(null);
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState("Connecting to live tracking...");
    const [lastReceived, setLastReceived] = useState(null);
    const [stale, setStale] = useState(false);

    const destination = getDestination(deliveryLocation);

    // Connect to Socket.IO and join authorized tracking room.
    useEffect(() => {
        if(!orderId || !token){
            setStatus("Login is required to view live tracking.");
            return;
        }

        let active = true;

        setRiderPosition(null);
        setConnected(false);
        setLastReceived(null);
        setStale(false);
        setStatus("Connecting to live tracking...");

        const socket = io(SOCKET_URL, {
            auth: {
                token,
                role: "customer"
            },
            transports: ["websocket", "polling"],
            reconnection: true,
            timeout: 10000
        });

        socket.on("connect", () => {
            if(!active){
                return;
            }

            setConnected(true);
            setStatus("Joining delivery tracking...");

            socket.timeout(10000).emit("tracking:join", orderId, (error, response) => {
                if(!active){
                    return;
                }

                if(error || !response?.success){
                    setStatus(response?.message || "Unable to join delivery tracking.");
                    return;
                }

                setStatus("Connected. Waiting for rider GPS location...");
            });
        });

        socket.on("tracking:location-updated", (data) => {
            if(!active || String(data?.orderId) !== String(orderId)){
                return;
            }

            if(!isValidPosition(data.latitude, data.longitude)){
                return;
            }

            setRiderPosition({
                latitude: data.latitude,
                longitude: data.longitude
            });

            setLastReceived(Date.now());
            setStale(false);
            setStatus("Receiving live rider location.");
        });

        socket.on("connect_error", (error) => {
            if(!active){
                return;
            }

            setConnected(false);
            setStatus(error.message || "Unable to connect to tracking.");
        });

        return () => {
            active = false;

            if(socket.connected){
                socket.emit("tracking:leave", orderId);
            }

            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [orderId, token]);

    // Detect outdated GPS data.
    useEffect(() => {
        if(!lastReceived){
            return;
        }

        const interval = setInterval(() => {
            const outdated = Date.now() - lastReceived > 20000;

            setStale(outdated);
        }, 3000);

        return() => {
            clearInterval(interval);
        }
    }, [lastReceived]);

    const centerPosition = riderPosition || destination;

    // Initialize map after a destination or rider coordinate exists.
    useEffect(() => {
        if(!centerPosition || !mapElementRef.current){
            return;
        }

        if(!mapRef.current){
            const map = L.map(mapElementRef.current, {zoomControl: true}).setView([centerPosition.latitude, centerPosition.longitude], 15);

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors'
                }
            ).addTo(map);

            mapRef.current = map;

            setTimeout(() => {
                if(mapRef.current === map){
                    map.invalidateSize();
                }
            }, 100);
        }

        const map = mapRef.current;

        if(destination && !destinationMarkerRef.current){
            destinationMarkerRef.current = L.circleMarker(
                [destination.latitude, destination.longitude],
                {
                    radius: 9,
                    color: "#b42318",
                    weight: 3,
                    fillColor: "#ffffff",
                    fillOpacity: 1
                }
            ).addTo(map).bindPopup("Your Delivery Location");
        }

        if(riderPosition){
            if(!riderMarkerRef.current){
                riderMarkerRef.current = L.circleMarker(
                    [riderPosition.latitude, riderPosition.longitude],
                    {
                        radius: 11,
                        color: "#ffffff",
                        weight: 3,
                        fillColor: "#008d40",
                        fillOpacity: 1
                    }
                ).addTo(map).bindPopup("Live Rider Location");
            } else {
                riderMarkerRef.current.setLatLng([
                    riderPosition.latitude,
                    riderPosition.longitude
                ]);
            }

            map.panTo([
                riderPosition.latitude,
                riderPosition.longitude
            ]);
        }
    }, [
        centerPosition?.latitude,
        centerPosition?.longitude,
        destination?.latitude,
        destination?.longitude,
        riderPosition?.latitude,
        riderPosition?.longitude
    ]);

    // Destroy map only when the component is unmounted.
    useEffect(() => {
        return () => {
            if(mapRef.current){
                mapRef.current.remove();
                mapRef.current = null;
                riderMarkerRef.current = null;
                destinationMarkerRef.current = null;
            }
        };
    }, []);

    const live = connected && riderPosition && !stale;

    return (
        <section className="live-rider-map">
            <div className="live-rider-map-header">
                <div className="live-rider-map-heading">
                    <span className="live-rider-map-icon">
                        <MapPin size={20}/>
                    </span>

                    <div>
                        <h3>Live Rider Tracking</h3>
                        <p>
                            Follow your delivery in real time.
                        </p>
                    </div>
                </div>

                <span className={`live-rider-map-badge ${live ? "active" : "waiting"}`}>
                    {live ? (
                        <>
                            <Radio size={14}/>
                            Live
                        </>
                    ) : (
                        <>
                            <WifiOff size={14}/>
                            Waiting
                        </>
                    )}
                </span>
            </div>

            <div className="live-rider-map-status" role="status">
                <span className={`live-rider-map-dot ${live ? "active" : ""}`}/>

                <p>
                    {stale ? "Rider location is outdated. Waiting for a new update." : status}
                </p>
            </div>

            <div className="live-rider-map-container">
                {!centerPosition && (
                    <div className="live-rider-map-placeholder">
                        <Navigation size={34}/>
                        <h4>Waiting for Rider Location</h4>
                        <p>
                            The map will appear when the rider starts sharing their GPS location.
                        </p>
                    </div>
                )}

                <div ref={mapElementRef} className="live-rider-map-canvas" style={{ display: centerPosition ? "block" : "none" }}/>
            </div>

            <div className="live-rider-map-footer">
                <div className="live-rider-map-legend">
                    <span>
                        <i className="live-rider-map-rider-dot"/>
                        Rider
                    </span>

                    {destination && (
                        <span>
                            <i className="live-rider-map-destination-dot"/>
                            Delivery Location
                        </span>
                    )}
                </div>

                {lastReceived && (
                    <span className="live-rider-map-updated">
                        Last update:{" "}
                        {new Date(lastReceived).toLocaleTimeString()}
                    </span>
                )}
            </div>
        </section>
    );
}

export default LiveRiderMap;