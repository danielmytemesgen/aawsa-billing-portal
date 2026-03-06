'use server';

import { revalidatePath } from 'next/cache';
import {
    dbGetActivePromotions,
    dbGetAllPromotions,
    dbCreatePromotion,
    dbUpdatePromotion,
    dbDeletePromotion
} from './db-queries';

export async function getActivePromotionsAction() {
    try {
        const promotions = await dbGetActivePromotions();
        return { success: true, data: promotions };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getAllPromotionsAction() {
    try {
        const promotions = await dbGetAllPromotions();
        return { success: true, data: promotions };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createPromotionAction(promotion: any) {
    try {
        const newPromo = await dbCreatePromotion(promotion);
        revalidatePath('/');
        return { success: true, data: newPromo };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updatePromotionAction(id: string, promotion: any) {
    try {
        const updatedPromo = await dbUpdatePromotion(id, promotion);
        revalidatePath('/');
        return { success: true, data: updatedPromo };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deletePromotionAction(id: string) {
    try {
        await dbDeletePromotion(id);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
