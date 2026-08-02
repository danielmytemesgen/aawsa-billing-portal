/**
 * Utility for handling geolocation and distance calculations.
 */

export interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

/**
 * Gets the current position of the user with enhanced accuracy tracking.
 * Waits for a high-accuracy reading or times out after 10 seconds with the best available reading.
 */
export const getCurrentPosition = async (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your environment."));
            return;
        }

        let bestPosition: GeolocationPosition | null = null;
        const timeout = 15000; // Reduced to 15 seconds for faster feedback
        const accuracyThreshold = 15; // 15 meters threshold for early resolution

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                // If we get an extremely accurate position, resolve immediately
                if (position.coords.accuracy <= accuracyThreshold) {
                    navigator.geolocation.clearWatch(watchId);
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    });
                    return;
                }

                // Otherwise, keep track of the best (most accurate) position so far
                if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                }
            },
            (error) => {
                // If it's a timeout error and we have a bestPosition, we'll ignore it and let the timer handle it
                // If it's a permission error or something else, and we have no position, reject
                if (!bestPosition && error.code !== error.TIMEOUT) {
                    navigator.geolocation.clearWatch(watchId);
                    reject(error);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: timeout,
                maximumAge: 5000, // Allow 5s old positions
            }
        );

        // After timeout, resolve with the best position we found, if any
        setTimeout(() => {
            navigator.geolocation.clearWatch(watchId);
            if (bestPosition) {
                resolve({
                    latitude: (bestPosition as GeolocationPosition).coords.latitude,
                    longitude: (bestPosition as GeolocationPosition).coords.longitude,
                    accuracy: (bestPosition as GeolocationPosition).coords.accuracy,
                });
            } else {
                reject(new Error("Location request timed out. Please ensure you are in an open area and GPS is enabled."));
            }
        }, timeout);
    });
};

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (coord1.latitude * Math.PI) / 180;
    const phi2 = (coord2.latitude * Math.PI) / 180;
    const deltaPhi = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const deltaLambda = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Checks if a user is within a specified proximity (default 5 meters) of a target coordinate.
 * Accounts for GPS accuracy to reduce false negatives in poor signal areas.
 */
export const checkProximity = (userCoords: Coordinates, targetCoords: Coordinates, threshold: number = 5): { isWithinRange: boolean; distance: number } => {
    const distance = calculateDistance(userCoords, targetCoords);
    
    // Subtract accuracy buffer from distance to get the minimum potential distance.
    // We cap the accuracy buffer at 15m to prevent total bypass in extremely poor signal areas.
    const accuracyBuffer = Math.min(userCoords.accuracy || 0, 15);
    const effectiveDistance = Math.max(0, distance - accuracyBuffer);
    
    return {
        isWithinRange: effectiveDistance <= threshold,
        distance,
    };
};

