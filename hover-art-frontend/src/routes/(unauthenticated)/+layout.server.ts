import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // If the user IS already authenticated, prevent them from accessing 
    // authentication pages (login/register). Send them to the main protected area.
    if (locals.user) {
        throw redirect(302, '/whiteboard');
    }
    return {};
};
