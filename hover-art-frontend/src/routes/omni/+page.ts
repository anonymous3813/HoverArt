import type { PageLoad } from './$types';
export const load: PageLoad = async () => {
    return {
        title: 'Omni — Skill tree & browser extension'
    };
};
export const ssr = false;
