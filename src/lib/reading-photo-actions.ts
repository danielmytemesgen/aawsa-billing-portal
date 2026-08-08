"use server";

import { dbGetPhotosByReadingId } from "./db-queries";

export async function getPhotosByReadingIdAction(readingId: string) {
    try {
        const rows: any[] = await dbGetPhotosByReadingId(readingId) as any[];

        // photo_data is bytea in PostgreSQL — Node.js returns it as a Buffer.
        // Convert to a base64 data-URL string before sending to the client.
        const data = rows.map((row) => {
            const raw = row.photo_data;
            let photoDataStr: string | null = null;

            if (raw != null) {
                if (Buffer.isBuffer(raw)) {
                    photoDataStr = `data:image/webp;base64,${raw.toString('base64')}`;
                } else if (typeof raw === 'string') {
                    photoDataStr = raw.startsWith('data:') ? raw : `data:image/webp;base64,${raw}`;
                } else if (raw?.data) {
                    // Fallback: pg may return { type: 'Buffer', data: [...] }
                    photoDataStr = `data:image/webp;base64,${Buffer.from(raw.data).toString('base64')}`;
                }
            }

            return {
                ...row,
                photo_data: photoDataStr,
            };
        });

        return { data, error: null };
    } catch (error: any) {
        console.error("Error in getPhotosByReadingIdAction:", error);
        return { data: null, error: error.message };
    }
}
