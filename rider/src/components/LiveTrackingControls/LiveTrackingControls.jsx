import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MapPin, Radio, Square, ShieldCheck, Wifi, WifiOff, LoaderCircle, Navigation } from "lucide-react";
import { toast } from "react-toastify";
import "./LiveTrackingControls.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4911";

const GPS_INTERVAL_MS = 10000;
const GPS_TIMEOUT_MS = 8000;
const ACK_TIMEOUT_MS = 10000;

function LiveTrackingControls({ orderId }) {
    const socketRef = useRef(null);
    const gpsIntervalRef = useRef(null);
    const gpsPendingRef = useRef(false);
    const stoppedRef = useRef(true);
    const generationRef = useRef(0);
    const joinedRef = useRef(false);

    const [tracking, setTracking] = useState(false);
    const [starting, setStarting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState("Location sharing is off.");
    const [lastUpdated, setLastUpdated] = useState(null);

    // Cleanup GPS polling and socket connection.
    const cleanup = () => {
        stoppedRef.current = true;
        generationRef.current += 1;
        joinedRef.current = false;

        if(gpsIntervalRef.current !== null){
            clearInterval(gpsIntervalRef.current);
            gpsIntervalRef.current = null;
        }

        gpsPendingRef.current = false;

        const socket = socketRef.current;

        if(socket){
            socketRef.current = null;

            if(socket.connected){
                socket.emit("tracking:leave", orderId);
            }

            socket.removeAllListeners();
            socket.disconnect();
        }
    };

    const stopTracking = () => {
        cleanup();

        setTracking(false);
        setStarting(false);
        setConnected(false);
        setStatus("Location sharing is off.");
        setLastUpdated(null);
    };

    // Stop sharing when component is unmounted.
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [orderId]);

    // Request a fresh GPS reading.
    const sendCurrentLocation = (generation) => {
        if(stoppedRef.current || generation !== generationRef.current || gpsPendingRef.current || !joinedRef.current || !socketRef.current?.connected){
            return;
        }

        gpsPendingRef.current = true;

        navigator.geolocation.getCurrentPosition((position) => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            gpsPendingRef.current = false;

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
                setStatus("Invalid GPS coordinates.");
                return;
            }

            // Reject inaccurate readings.
            if(!Number.isFinite(accuracy) || accuracy > 150){
                setStatus("Waiting for an accurate GPS location...");
                return;
            }

            // Only send genuinely fresh positions.
            const readingAge = Date.now() - position.timestamp;

            if(readingAge < 0 || readingAge > 15000){
                setStatus("Waiting for a fresh GPS location...");
                return;
            }

            const socket = socketRef.current;

            if(!socket?.connected || !joinedRef.current){
                return;
            }

            socket.timeout(ACK_TIMEOUT_MS).emit("tracking:location", {orderId, latitude, longitude}, (error, response) => {
                if(stoppedRef.current || generation !== generationRef.current){
                    return;
                }

                if(error){
                    setStatus("GPS update timed out. Retrying...");
                    return;
                }

                if(response?.success){
                    setTracking(true);
                    setConnected(true);
                    setLastUpdated(new Date());
                    setStatus("Live location is being shared.");
                } else {
                    const message = response?.message || "Unable to share GPS location.";

                    if(message.includes("not authorized") || message.includes("Join tracking") || message.includes("not active")){
                        toast.error(message);
                        stopTracking();
                        return;
                    }

                    setStatus(message);
                }
            });
        }, (error) => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            gpsPendingRef.current = false;

            if(error.code === 1){
                toast.error("Location permission denied.");

                stopTracking();
                return;
            }

            if(error.code === 2){
                setStatus("GPS unavailable. Retrying...");
                return;
            }

            setStatus("Waiting for a GPS reading...");
        },{
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: GPS_TIMEOUT_MS
        });
    };

    // Start GPS polling every 10 seconds.
    const startGpsHeartbeat = (generation) => {
        if(gpsIntervalRef.current !== null){
            return;
        }

        // Get location immediately.
        sendCurrentLocation(generation);

        gpsIntervalRef.current = setInterval(() => {
            sendCurrentLocation(generation);
        }, GPS_INTERVAL_MS);
    };

    const startTracking = () => {
        if(starting || tracking){
            return;
        }

        const token = localStorage.getItem("riderToken");

        if(!token){
            toast.error("Please login as a rider.");
            return;
        }

        if(!orderId){
            toast.error("Order ID is missing.");
            return;
        }

        if(!navigator.geolocation){
            toast.error("GPS is not supported by this browser.");
            return;
        }

        if(!window.isSecureContext){
            toast.error("GPS requires HTTPS or localhost.");
            return;
        }

        cleanup();

        stoppedRef.current = false;

        const generation = generationRef.current;

        setStarting(true);
        setTracking(false);
        setConnected(false);
        setLastUpdated(null);
        setStatus("Connecting to tracking server...");

        const socket = io(SOCKET_URL, {
            auth: {
                token,
                role: "rider"
            },
            transports: ["websocket", "polling"],
            timeout: 10000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            joinedRef.current = false;

            setConnected(true);
            setStatus("Joining delivery tracking...");

            socket.timeout(ACK_TIMEOUT_MS).emit("tracking:join", orderId, (error, response) => {
                if(stoppedRef.current || generation !== generationRef.current || !socket.connected){
                    return;
                }

                if(error || !response?.success){
                    toast.error(response?.message || "Unable to join tracking.");

                    stopTracking();
                    return;
                }

                joinedRef.current = true;

                setStarting(false);
                setTracking(true);
                setStatus("Getting GPS location...");

                startGpsHeartbeat(generation);
            });
        });

        socket.on("disconnect", () => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            joinedRef.current = false;

            setConnected(false);
            setStatus("Connection lost. Reconnecting...");
        });

        socket.on("connect_error", (error) => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            const message = error.message || "";

            if(/token|unauthorized|inactive|identity|expired|authentication/i.test(message)){
                toast.error(message);
                stopTracking();
                return;
            }

            setConnected(false);
            setStatus("Connection failed. Retrying...");
        });

        socket.io.on("reconnect_failed", () => {
            if(stoppedRef.current || generation !== generationRef.current){
                return;
            }

            toast.error("Live tracking connection failed.");

            stopTracking();
        });
    };

    const isActive = tracking && connected;

    return (
        <section className="live-tracking">
            <div className="live-tracking-header">
                <div className="live-tracking-icon">
                    <MapPin size={22}/>
                </div>

                <div className="live-tracking-heading">
                    <h3>Live Rider Tracking</h3>
                    <p>Real-time GPS location sharing</p>
                </div>

                <span className={`live-tracking-connection ${isActive ? "online" : "offline"}`}>
                    {isActive ? (
                        <Wifi size={16}/>
                    ) : (
                        <WifiOff size={16}/>
                    )}
                </span>
            </div>

            <div className="live-tracking-status">
                <span className={`live-tracking-dot ${isActive ? "active" : starting || tracking ? "connecting" : ""}`}/>

                <div className="live-tracking-status-info">
                    <strong>
                        {isActive ? "Tracking Active" : starting || tracking ? "Connecting" : "Tracking Inactive"}
                    </strong>

                    <p role="status">{status}</p>
                </div>
            </div>

            {lastUpdated && (
                <div className="live-tracking-last-update">
                    <Navigation size={15}/>

                    <span>
                        Last GPS Update:{" "}
                        {lastUpdated.toLocaleTimeString(
                            "en-US",
                            {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            }
                        )}
                    </span>
                </div>
            )}

            <div className="live-tracking-actions">
                {!tracking && !starting ? (
                    <button type="button" className="live-tracking-button start" onClick={startTracking}>
                        <Radio size={18}/>
                        Start Live Tracking
                    </button>
                ) : (
                    <>
                        {starting && (
                            <div className="live-tracking-starting">
                                <LoaderCircle size={18} className="live-tracking-spinner"/>
                                Starting GPS Tracking...
                            </div>
                        )}

                        <button type="button" className="live-tracking-button stop" onClick={stopTracking}>
                            <Square size={16}/>
                            Stop Live Tracking
                        </button>
                    </>
                )}
            </div>

            <div className="live-tracking-privacy">
                <ShieldCheck size={17}/>
                <p>
                    Your location is shared only for this active delivery. You can stop tracking at any time. Closing these order details also stops sharing.
                </p>
            </div>
        </section>
    );
}

export default LiveTrackingControls;