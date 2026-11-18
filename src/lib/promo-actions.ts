'use server';

import { revalidatePath } from 'next/cache';
import {
    dbGetActivePromotions,
    dbGetAllPromotions,
    dbCreatePromotion,
    dbUpdatePromotion,
    dbDeletePromotion,
    dbGetLoginHeroSettings,
    dbUpdateLoginHeroSettings
} from './db-queries';
import { checkPermission, checkPermissionAny } from './actions';
import { PERMISSIONS } from './constants/auth';

// NOTE: This action is intentionally public (used on the login screen
// via auth-ads to show marketing banners before the user signs in).
// Only marketing/promotional fields should be exposed by dbGetActivePromotions.
export async function getActivePromotionsAction() {
    try {
        const [promotions, hero] = await Promise.all([
            dbGetActivePromotions(),
            dbGetLoginHeroSettings()
        ]);
        return { success: true, data: promotions, hero };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getLoginHeroSettingsAction() {
    try {
        const hero = await dbGetLoginHeroSettings();
        return { success: true, data: hero };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateLoginHeroSettingsAction(settings: {
    title: string;
    highlight?: string;
    description: string;
    styles?: any;
}) {
    try {
        await checkPermissionAny(PERMISSIONS.PROMOTIONS_MANAGE, PERMISSIONS.SETTINGS_MANAGE);
        const hero = await dbUpdateLoginHeroSettings(settings);
        revalidatePath('/');
        revalidatePath('/customer-login');
        return { success: true, data: hero };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getAllPromotionsAction() {
    try {
        await checkPermission(PERMISSIONS.SETTINGS_VIEW);
        const promotions = await dbGetAllPromotions();
        return { success: true, data: promotions };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createPromotionAction(promotion: any) {
    try {
        await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
        const newPromo = await dbCreatePromotion(promotion);
        revalidatePath('/');
        return { success: true, data: newPromo };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updatePromotionAction(id: string, promotion: any) {
    try {
        await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
        const updatedPromo = await dbUpdatePromotion(id, promotion);
        revalidatePath('/');
        return { success: true, data: updatedPromo };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deletePromotionAction(id: string) {
    try {
        await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
        await dbDeletePromotion(id);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
