/**
 * Fault Codes for Meter Readings
 * 
 * Standard fault codes used when meter readings cannot be taken normally
 * or when there are issues with the meter.
 */

export const FAULT_CODES = {
    BROKEN: {
        code: "BROKEN",
        label: "Meter Broken",
        description: "Physical damage to meter",
        color: "#ef4444" // red
    },
    BLOCKED: {
        code: "BLOCKED",
        label: "Meter Blocked",
        description: "Access blocked or obstructed",
        color: "#f59e0b" // amber
    },
    MISSING: {
        code: "MISSING",
        label: "Meter Missing",
        description: "Meter not found at location",
        color: "#dc2626" // red
    },
    OVERFLOW: {
        code: "OVF",
        label: "Overflow",
        description: "Reading exceeds meter capacity",
        color: "#7c3aed" // violet
    },
    REVERSED: {
        code: "REVERSED",
        label: "Reversed Flow",
        description: "Meter running backwards",
        color: "#ea580c" // orange
    },
    STUCK: {
        code: "STUCK",
        label: "Meter Stuck",
        description: "Meter not registering usage",
        color: "#64748b" // slate
    },
    ILLEGIBLE: {
        code: "ILLEGIBLE",
        label: "Illegible Reading",
        description: "Cannot read meter display",
        color: "#6366f1" // indigo
    },
    TAMPERED: {
        code: "TAMPERED",
        label: "Tampered",
        description: "Evidence of tampering",
        color: "#dc2626" // red
    },
    LEAKING: {
        code: "LEAKING",
        label: "Leaking",
        description: "Water leak detected at meter",
        color: "#0ea5e9" // sky
    },
    OTHER: {
        code: "OTHER",
        label: "Other Fault",
        description: "Other issues not listed",
        color: "#71717a" // zinc
    }
} as const;

export type FaultCodeKey = keyof typeof FAULT_CODES;
export type FaultCode = typeof FAULT_CODES[FaultCodeKey];

/**
 * Get all fault codes as an array
 */
export function getAllFaultCodes(): FaultCode[] {
    return Object.values(FAULT_CODES);
}

/**
 * Get fault code by code string
 */
export function getFaultCodeByCode(code: string): FaultCode | undefined {
    return getAllFaultCodes().find(fc => fc.code === code);
}

/**
 * Get fault code label by code string
 */
export function getFaultCodeLabel(code: string): string {
    const faultCode = getFaultCodeByCode(code);
    return faultCode ? faultCode.label : code;
}

/**
 * Get fault code color by code string
 */
export function getFaultCodeColor(code: string): string {
    const faultCode = getFaultCodeByCode(code);
    return faultCode ? faultCode.color : "#71717a";
}
