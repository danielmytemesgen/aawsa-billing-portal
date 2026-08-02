import { getFaultCodes, DomainFaultCode } from '@/lib/data-store';

export interface FaultCode {
    code: string;
    label: string;
    description: string;
    color: string;
    category?: string | null;
}

const DEFAULT_COLORS: Record<string, string> = {
    BROKEN: "#ef4444",
    BLOCKED: "#f59e0b",
    MISSING: "#dc2626",
    OVF: "#7c3aed",
    OVERFLOW: "#7c3aed",
    REVERSED: "#ea580c",
    STUCK: "#64748b",
    ILLEGIBLE: "#6366f1",
    TAMPERED: "#dc2626",
    LEAKING: "#0ea5e9",
    OTHER: "#71717a"
};

function mapDomainToFaultCode(item: DomainFaultCode): FaultCode {
    const codeUpper = (item.code || '').toUpperCase();
    const desc = item.description && item.description.trim() !== '' ? item.description : item.code;
    return {
        code: item.code,
        label: desc,
        description: desc,
        category: item.category || null,
        color: DEFAULT_COLORS[codeUpper] || "#6366f1"
    };
}

/**
 * Get all fault codes dynamically from live database
 */
export function getAllFaultCodes(): FaultCode[] {
    const liveCodes = getFaultCodes();
    if (liveCodes && liveCodes.length > 0) {
        return liveCodes.map(mapDomainToFaultCode);
    }
    return [];
}

/**
 * Get fault code by code string from live database
 */
export function getFaultCodeByCode(code: string): FaultCode | undefined {
    if (!code) return undefined;
    const target = code.trim().toLowerCase();
    return getAllFaultCodes().find(fc => fc.code.trim().toLowerCase() === target);
}

/**
 * Get fault code label by code string from live database
 */
export function getFaultCodeLabel(code: string): string {
    if (!code) return "";
    const faultCode = getFaultCodeByCode(code);
    return faultCode ? faultCode.label : code;
}

/**
 * Get fault code color by code string from live database
 */
export function getFaultCodeColor(code: string): string {
    if (!code) return "#71717a";
    const faultCode = getFaultCodeByCode(code);
    return faultCode ? faultCode.color : "#71717a";
}

/**
 * Proxy object for legacy FAULT_CODES access to ensure live database values are always returned
 */
export const FAULT_CODES: Record<string, FaultCode> = new Proxy({}, {
    get(_target, prop: string) {
        return getFaultCodeByCode(prop) || {
            code: prop,
            label: prop,
            description: prop,
            color: "#71717a"
        };
    },
    ownKeys() {
        return getAllFaultCodes().map(fc => fc.code);
    },
    getOwnPropertyDescriptor(_target, prop: string) {
        const fc = getFaultCodeByCode(prop);
        if (fc) {
            return { configurable: true, enumerable: true, value: fc };
        }
        return undefined;
    }
});

export type FaultCodeKey = string;

