"use server";

import { dbGetPhotosByReadingId } from "./db-queries";

export async function getPhotosByReadingIdAction(readingId: string) {
    try {
        const data = await dbGetPhotosByReadingId(readingId);
        return { data, error: null };
    } catch (error: any) {
        console.error("Error in getPhotosByReadingIdAction:", error);
        return { data: null, error: error.message };
    }
}
