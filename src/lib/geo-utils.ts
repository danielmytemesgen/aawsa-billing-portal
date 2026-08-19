/**
 * Utility for handling geolocation and distance calculations.
 */

export interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

export const GPS_MAX_ACCURACY_THRESHOLD = 30; // Maximum acceptable GPS accuracy in meters for reading capture

/** Returns true if the GPS accuracy is within the reliable threshold (< 30m). */
export const isGpsAccuracyAcceptable = (accuracy?: number): boolean => {
    if (accuracy === undefined || accuracy === null) return true;
    return accuracy <= GPS_MAX_ACCURACY_THRESHOLD;
};

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
        excellent: { color: 'text-emerald-600', bgColor: 'bg-emerald-500', progress: 100, label: 'Excellent (≤5m)' },
        good:      { color: 'text-green-600',   bgColor: 'bg-green-500',   progress: 75,  label: 'Good (≤15m)' },
        fair:      { color: 'text-amber-600',   bgColor: 'bg-amber-400',   progress: 45,  label: 'Fair (≤30m)' },
        poor:      { color: 'text-red-600',     bgColor: 'bg-red-400',     progress: 20,  label: 'Weak (>30m Drift)' },
    };
    return map[quality];
};

/**
 * Gets the current position using a fast-lock multi-sample strategy:
 * 1. Resolves immediately if accuracy <= 25m (urban GPS / clear sky).
 * 2. First sample with acceptable accuracy (<= 35m) resolves within 1.5s max.
 * 3. Averages samples if multiple are collected within 4 seconds.
 * 4. Total timeout reduced to 4.5 seconds for instant field verification.
 */
export const getCurrentPosition = async (
    onProgress?: (accuracy: number) => void
): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your environment.'));
            return;
        }

        const ACCURACY_EXCELLENT = 25;    // Immediate resolution threshold (≤ 25m)
        const ACCURACY_ACCEPTABLE = 40;   // Good field reading threshold (≤ 40m)
        const MAX_SAMPLES        = 4;     // Maximum samples
        const TIMEOUT_MS         = 4500;  // Ultra-fast 4.5s max wait time

        const samples: GeolocationPosition[] = [];
        let resolved = false;
        let watchId: number;

        const doResolve = (pos: GeolocationPosition | { coords: { latitude: number; longitude: number; accuracy?: number } }) => {
            if (resolved) return;
            resolved = true;
            if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
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
            if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
            clearTimeout(timer);

            if (samples.length === 0) {
                // Try last known good location from localStorage before failing
                try {
                    const raw = localStorage.getItem('last_user_location');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed?.coords && (Date.now() - (parsed.t || 0)) < 24 * 60 * 60 * 1000) {
                            resolve(parsed.coords);
                            return;
                        }
                    }
                } catch { /* ignore */ }

                reject(new Error('Location request timed out. Please tap "Bypass" or step outdoors.'));
                return;
            }

            const best = [...samples]
                .sort((a, b) => a.coords.accuracy - b.coords.accuracy)
                .slice(0, 3);

            const avgLat = best.reduce((s, p) => s + p.coords.latitude, 0) / best.length;
            const avgLng = best.reduce((s, p) => s + p.coords.longitude, 0) / best.length;
            const avgAcc = best.reduce((s, p) => s + p.coords.accuracy, 0) / best.length;

            resolve({ latitude: avgLat, longitude: avgLng, accuracy: avgAcc });
        };

        const timer = setTimeout(doAveragedResolve, TIMEOUT_MS);

        // Fast-path: check if browser already has a fresh cached position (<60s old)
        try {
            navigator.geolocation.getCurrentPosition(
                (quickPos) => {
                    if (quickPos?.coords?.accuracy && quickPos.coords.accuracy <= ACCURACY_EXCELLENT) {
                        onProgress?.(quickPos.coords.accuracy);
                        doResolve(quickPos);
                    }
                },
                () => {},
                { enableHighAccuracy: false, maximumAge: 60000, timeout: 1000 }
            );
        } catch { /* ignore fast-path error */ }

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const acc = position.coords.accuracy;
                onProgress?.(acc);

                samples.push(position);
                if (samples.length > MAX_SAMPLES) {
                    samples.sort((a, b) => a.coords.accuracy - b.coords.accuracy);
                    samples.splice(MAX_SAMPLES);
                }

                // Resolve immediately on good urban accuracy
                if (acc <= ACCURACY_EXCELLENT) {
                    doResolve(position);
                    return;
                }

                // If accuracy is acceptable (≤ 40m) on 2nd sample or later, resolve without waiting 4.5s
                if (samples.length >= 2 && acc <= ACCURACY_ACCEPTABLE) {
                    doResolve(position);
                }
            },
            (error) => {
                if (!resolved && samples.length === 0 && error.code !== error.TIMEOUT) {
                    clearTimeout(timer);
                    resolved = true;
                    if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
                    let msg = 'Could not acquire GPS location.';
                    if (error.code === error.PERMISSION_DENIED) {
                        msg = 'Location permission denied. Please allow GPS access in your browser settings or tap Bypass.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        msg = 'GPS signal unavailable. Move to an open area or tap Bypass.';
                    }
                    reject(new Error(msg));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: TIMEOUT_MS,
                maximumAge: 10000
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
 * Triggers a sharp, tactile double-tap vibration when a meter reading is recorded (online or offline).
 */
export const triggerReadingSavedHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate([50, 40, 50]);
        } catch {
            // Ignore if unsupported
        }
    }
};

/**
 * Triggers an alert vibration pattern for errors or conflicts.
 */
export const triggerWarningHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate([100, 50, 100, 50, 100]);
        } catch {
            // Ignore if unsupported
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
