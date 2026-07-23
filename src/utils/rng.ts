// Source - https://stackoverflow.com/a/47593316
// Posted by bryc, modified by community. See post 'Timeline' for change history
// Retrieved 2026-07-23, License - CC BY-SA 4.0

export const genSeed = () => (Math.random()*2**32)>>>0;

// From the Mulberry32 generator. Pass seed in parameter to generate in a 32-bit state
// state added to have a sequence be reproducible for each seed
function mulberry32(a: any) {
    // Use a bitwise OR to force the initial state into a 32-bit integer
    let state = a | 0; 

    return function() {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ state >>> 15, state | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/*
How to use:
let rand = getSeededRand(seed);
console.log(rand()) <- follows the same sequence each time
*/
export function getSeededRand(seed: any) {
    return mulberry32(seed);
}