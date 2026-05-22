"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedUrl = exports.uploadProofImage = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
let _supabase = null;
function getSupabase() {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !key) {
            throw new Error('SUPABASE_URL และ SUPABASE_SERVICE_KEY ยังไม่ได้ตั้งค่าใน .env');
        }
        _supabase = (0, supabase_js_1.createClient)(url, key, {
            realtime: { transport: ws_1.default },
        });
    }
    return _supabase;
}
async function uploadProofImage(file, filename, mimeType) {
    const contentType = normalizeMimeType(mimeType, filename);
    const safeFilename = ensureFilenameWithExtension(sanitizeFilename(filename), extensionFromMime(contentType));
    const path = `tasks/${Date.now()}_${safeFilename}`;
    const { error } = await getSupabase().storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(path, file, { contentType });
    if (error)
        throw new Error(`Upload failed: ${error.message}`);
    return path;
}
exports.uploadProofImage = uploadProofImage;
async function getSignedUrl(path) {
    const { data, error } = await getSupabase().storage
        .from(process.env.SUPABASE_BUCKET)
        .createSignedUrl(path, 60 * 60);
    if (error)
        throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
}
exports.getSignedUrl = getSignedUrl;
function sanitizeFilename(filename) {
    const base = (filename || 'proof')
        .trim()
        .replace(/[^\w.\-]+/g, '_')
        .replace(/_+/g, '_');
    return base || 'proof';
}
function normalizeMimeType(mimeType, filename) {
    const raw = (mimeType || '').trim().toLowerCase();
    const cleaned = raw.split(';')[0].trim();
    if (/^[a-z0-9!#$&^_.+\-]+\/[a-z0-9!#$&^_.+\-]+$/.test(cleaned)) {
        return cleaned;
    }
    const ext = (filename || '').toLowerCase().split('.').pop() || '';
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'heic':
            return 'image/heic';
        default:
            return 'application/octet-stream';
    }
}
function extensionFromMime(mimeType) {
    switch (mimeType) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        case 'image/heic':
            return 'heic';
        default:
            return 'bin';
    }
}
function ensureFilenameWithExtension(filename, fallbackExt) {
    const hasExt = /\.[A-Za-z0-9]+$/.test(filename);
    if (hasExt)
        return filename;
    return `${filename}.${fallbackExt}`;
}
