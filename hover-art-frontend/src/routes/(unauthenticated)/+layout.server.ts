import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // If the user is already authenticated, redirect
    if (locals.user) {
        throw redirect(302, '/');
    }
    return {};
};
