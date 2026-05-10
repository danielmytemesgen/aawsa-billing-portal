
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
export const getCurrentPosition = (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
            return;
        }

        let bestPosition: GeolocationPosition | null = null;
        const timeout = 10000; // 10 seconds timeout
        const accuracyThreshold = 10; // 10 meters threshold for early resolution

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
                // If it's the first attempt and it fails, reject
                if (!bestPosition) {
                    navigator.geolocation.clearWatch(watchId);
                    reject(error);
                }
                // If we already have a bestPosition, we'll let the timeout handle it
            },
            {
                enableHighAccuracy: true,
                timeout: timeout,
                maximumAge: 0,
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
                // If still no position after timeout, it's an error
                reject(new Error("Location request timed out without a valid position."));
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
