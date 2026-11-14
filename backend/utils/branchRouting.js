const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const ROUTING_TIMEOUT_MS = 10000;

// Validate GPS coordinates
const isValidCoordinates = (location) => {
    if(!location || typeof location !== "object"){
        return false;
    }

    const { latitude, longitude } = location;

    return (
        typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );
};

// Calculate road distance between two GPS locations
const calculateRoadDistance = async (origin, destination) => {
    if(!isValidCoordinates(origin) || !isValidCoordinates(destination)){
        throw new Error("Invalid routing coordinates.");
    }

    // OSRM expects longitude,latitude
    const coordinates = `${origin.longitude},${origin.latitude};` + `${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_BASE_URL}/route/v1/driving/` + `${coordinates}?overview=false`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, ROUTING_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            headers: {
                Accept: "application/json"
            }
        });

        if(!response.ok){
            throw new Error("Routing service unavailable.");
        }

        const data = await response.json();

        if(data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0){
            throw new Error("No driving route found.");
        }

        const route = data.routes[0];

        if(!Number.isFinite(route.distance) || !Number.isFinite(route.duration) || route.distance < 0 || route.duration < 0){
            throw new Error("Invalid routing response.");
        }

        return {
            distanceKm: Number((route.distance / 1000).toFixed(2)),
            durationMinutes: Number((route.duration / 60).toFixed(1))
        };

    } catch (error) {
        if(error.name === "AbortError"){
            throw new Error("Routing request timed out.");
        }

        throw error;

    } finally {
        clearTimeout(timeout);
    }
};

export {isValidCoordinates, calculateRoadDistance};