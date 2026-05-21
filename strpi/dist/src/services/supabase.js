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
    const path = `tasks/${Date.now()}_${filename}`;
    const { error } = await getSupabase().storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(path, file, { contentType: mimeType });
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
