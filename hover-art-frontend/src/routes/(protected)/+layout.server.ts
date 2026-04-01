import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // If the user is not authenticated, redirect to the login page.
    if (!locals.user) {
        throw redirect(302, '/login');
    }
    
    // Pass the user object to all child routes for convenience.
    return {
        user: locals.user
    };
};
