import { dbValidateApiKey } from "./db-queries";

/**
 * Validates an API key from a request header.
 * @param apiKey The API key string from X-API-Key header.
 * @returns boolean indicating if the key is valid.
 */
export async function validateApiKey(apiKey: string | null): Promise<boolean> {
    if (!apiKey) return false;

    try {
        const isValid = await dbValidateApiKey(apiKey);
        return isValid;
    } catch (error) {
        console.error("Error validating API key:", error);
        return false;
    }
}
