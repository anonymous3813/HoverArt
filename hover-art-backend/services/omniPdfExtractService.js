import { PDFParse } from 'pdf-parse';
const MAX_PAGES = 140;
function toBuffer(input) {
    if (Buffer.isBuffer(input))
        return input;
    if (input instanceof Uint8Array)
        return Buffer.from(input);
    if (!input || typeof input.byteLength !== 'number')
        throw new Error('Invalid PDF payload.');
    return Buffer.from(input);
}
export async function extractPlainTextFromPdfBuffer(input) {
    const buf = toBuffer(input);
    if (!buf.length)
        throw new Error('Empty PDF upload.');
    const parser = new PDFParse({ data: buf });
    try {
        const result = await parser.getText({ first: MAX_PAGES });
        return String(result?.text ?? '').trim();
    }
    finally {
        await parser.destroy().catch(() => { });
    }
}
