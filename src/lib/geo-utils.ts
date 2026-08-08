/**
 * Utility for handling geolocation and distance calculations.
 */

export interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

/** Returns a label for GPS signal quality based on accuracy (meters). */
export const getGpsQualityLabel = (accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (accuracy <= 5)  return 'excellent';
    if (accuracy <= 15) return 'good';
    if (accuracy <= 30) return 'fair';
    return 'poor';
};

/** Returns color, bar progress (0–100), and label for a GPS accuracy value. */
export const getGpsSignalInfo = (accuracy: number): { color: string; bgColor: string; progress: number; label: string } => {
    const quality = getGpsQualityLabel(accuracy);
    const map = {
        excellent: { color: 'text-emerald-600', bgColor: 'bg-emerald-500', progress: 100, label: 'Excellent' },
        good:      { color: 'text-green-600',   bgColor: 'bg-green-500',   progress: 75,  label: 'Good' },
        fair:      { color: 'text-amber-600',   bgColor: 'bg-amber-400',   progress: 45,  label: 'Fair' },
        poor:      { color: 'text-red-600',     bgColor: 'bg-red-400',     progress: 20,  label: 'Poor' },
    };
    return map[quality];
};

/**
 * Gets the current position using a multi-sample strategy for maximum accuracy.
 *
 * Strategy:
 * 1. Watch positions continuously for up to 20 seconds.
 * 2. Resolve immediately if accuracy <= 10 m (excellent urban GPS).
 * 3. Average the best 3 samples if we cannot hit 10 m.
 * 4. Fall back to best single sample if timeout is reached.
 *
 * @param onProgress – optional callback fired on every new reading with
 *                     the current accuracy in meters, so the UI can display
 *                     a live signal quality bar.
 */
export const getCurrentPosition = async (
    onProgress?: (accuracy: number) => void
): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your environment.'));
            return;
        }

        const ACCURACY_EXCELLENT = 10;    // Resolve immediately at <= 10 m
        const ACCURACY_GOOD      = 20;    // Resolve averaged when best sample <= 20 m
        const MAX_SAMPLES        = 5;     // Maximum samples to collect
        const TIMEOUT_MS         = 20000; // Total wait time

        const samples: GeolocationPosition[] = [];
        let resolved = false;
        let watchId: number;

        const doResolve = (pos: GeolocationPosition) => {
            if (resolved) return;
            resolved = true;
            navigator.geolocation.clearWatch(watchId);
            clearTimeout(timer);
            resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
            });
        };

        const doAveragedResolve = () => {
            if (resolved) return;
            resolved = true;
            navigator.geolocation.clearWatch(watchId);
            clearTimeout(timer);

            if (samples.length === 0) {
                reject(new Error('Location request timed out. Please enable GPS and step into an open area.'));
                return;
            }

            // Average the best (most accurate) samples
            const best = [...samples]
                .sort((a, b) => a.coords.accuracy - b.coords.accuracy)
                .slice(0, 3);

            const avgLat = best.reduce((s, p) => s + p.coords.latitude, 0) / best.length;
            const avgLng = best.reduce((s, p) => s + p.coords.longitude, 0) / best.length;
            const avgAcc = best.reduce((s, p) => s + p.coords.accuracy, 0) / best.length;

            resolve({ latitude: avgLat, longitude: avgLng, accuracy: avgAcc });
        };

        const timer = setTimeout(doAveragedResolve, TIMEOUT_MS);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const acc = position.coords.accuracy;

                // Notify UI of live accuracy for signal quality display
                onProgress?.(acc);

                // Store sample; keep only best MAX_SAMPLES by accuracy
                samples.push(position);
                if (samples.length > MAX_SAMPLES) {
                    samples.sort((a, b) => a.coords.accuracy - b.coords.accuracy);
                    samples.splice(MAX_SAMPLES);
                }

                // Resolve immediately on excellent accuracy
                if (acc <= ACCURACY_EXCELLENT) {
                    doResolve(position);
                    return;
                }

                // Resolve averaged once we have 3+ good-enough samples
                const bestAcc = [...samples].sort((a, b) => a.coords.accuracy - b.coords.accuracy)[0]?.coords.accuracy ?? Infinity;
                if (samples.length >= 3 && bestAcc <= ACCURACY_GOOD) {
                    doAveragedResolve();
                }
            },
            (error) => {
                if (!resolved && samples.length === 0 && error.code !== error.TIMEOUT) {
                    clearTimeout(timer);
                    resolved = true;
                    navigator.geolocation.clearWatch(watchId);
                    let msg = 'Could not acquire GPS location.';
                    if (error.code === error.PERMISSION_DENIED) {
                        msg = 'Location permission denied. Please allow GPS access in your browser settings and refresh.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        msg = 'GPS signal unavailable. Move to an open area and try again.';
                    }
                    reject(new Error(msg));
                }
                // For TIMEOUT: let the setTimeout handler fire doAveragedResolve with whatever we have
            },
            {
                enableHighAccuracy: true,
                timeout: TIMEOUT_MS,
                maximumAge: 0, // Always request a fresh position — no cached results
            }
        );
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
 * Checks if a user is within proximity of a target coordinate.
 *
 * Default threshold is 15 m (accommodates typical urban GPS drift of 5–10 m).
 * An accuracy buffer is subtracted from effective distance so a reader
 * standing at the meter still passes even if GPS reports them slightly off.
 * The buffer is capped at 20 m to prevent full bypass in weak-signal areas.
 */
export const checkProximity = (
    userCoords: Coordinates,
    targetCoords: Coordinates,
    threshold: number = 15
): { isWithinRange: boolean; distance: number } => {
    const distance = calculateDistance(userCoords, targetCoords);

    // Subtract GPS accuracy so a reading within the device error margin still passes
    const accuracyBuffer = Math.min(userCoords.accuracy || 0, 20);
    const effectiveDistance = Math.max(0, distance - accuracyBuffer);

    return {
        isWithinRange: effectiveDistance <= threshold,
        distance,
    };
};

/**
 * Triggers a distinctive haptic vibration pattern when proximity verification passes.
 * Uses navigator.vibrate if supported by browser/device hardware.
 */
export const triggerProximityHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
            // Pulse: 120ms vibration, 60ms pause, 120ms vibration (success pattern)
            navigator.vibrate([120, 60, 120]);
        } catch {
            // Ignore if vibration is blocked by user gesture requirements
        }
    }
};

/**
 * Sorts an array of meter items by distance from user coordinates (closest first).
 */
export const sortMetersByDistance = <T extends { xCoordinate?: number | null; yCoordinate?: number | null }>(
    meters: T[],
    userCoords: Coordinates | null
): (T & { distanceMeters?: number })[] => {
    if (!userCoords) return meters;

    return meters
        .map(meter => {
            if (meter.xCoordinate != null && meter.yCoordinate != null) {
                const dist = calculateDistance(userCoords, {
                    latitude: Number(meter.yCoordinate),
                    longitude: Number(meter.xCoordinate)
                });
                return { ...meter, distanceMeters: dist };
            }
            return { ...meter, distanceMeters: undefined };
        })
        .sort((a, b) => {
            if (a.distanceMeters != null && b.distanceMeters != null) {
                return a.distanceMeters - b.distanceMeters;
            }
            if (a.distanceMeters != null) return -1;
            if (b.distanceMeters != null) return 1;
            return 0;
        });
};

/**
 * Calculates compass bearing from point A to point B in degrees (0–360).
 */
export const calculateBearing = (start: Coordinates, end: Coordinates): number => {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
};

/**
 * Returns cardinal direction label (North, North-East...) and arrow indicator.
 */
export const getCardinalDirection = (bearing: number): { label: string; arrow: string } => {
    const directions = [
        { label: 'North', arrow: '↑' },
        { label: 'North-East', arrow: '↗' },
        { label: 'East', arrow: '→' },
        { label: 'South-East', arrow: '↘' },
        { label: 'South', arrow: '↓' },
        { label: 'South-West', arrow: '↙' },
        { label: 'West', arrow: '←' },
        { label: 'North-West', arrow: '↖' },
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
};

/**
 * Generates turn-by-turn navigation URL for mobile map apps (Google Maps / Apple Maps).
 */
export const getDirectionsUrl = (target: { latitude: number; longitude: number }, userLoc?: Coordinates | null): string => {
    if (userLoc) {
        return `https://www.google.com/maps/dir/?api=1&origin=${userLoc.latitude},${userLoc.longitude}&destination=${target.latitude},${target.longitude}&travelmode=walking`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${target.latitude},${target.longitude}`;
};

/**
 * Plays a pleasant arrival chime or voice prompt when arriving at a meter site.
 */
export const playProximityArrivalAlert = (meterName?: string) => {
    if (typeof window === 'undefined') return;

    // 1. Spoken voice announcement if SpeechSynthesis is available
    if ('speechSynthesis' in window && meterName) {
        try {
            window.speechSynthesis.cancel(); // cancel previous utterance
            const utterance = new SpeechSynthesisUtterance(`Arrived at ${meterName}`);
            utterance.rate = 1.0;
            utterance.pitch = 1.05;
            window.speechSynthesis.speak(utterance);
            return;
        } catch {
            // Fall through to Web Audio chime
        }
    }

    // 2. Fallback Web Audio API chime (two pleasant ascending notes: C5 -> G5)
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(783.99, now + 0.15); // G5

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
    } catch {
        // Ignore audio errors if blocked by browser policy
    }
};
