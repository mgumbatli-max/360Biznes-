// FormData / Request tip fixi — @types/node v20.19 "web-globals" bug-u.
//
// @types/node "web-globals/fetch.d.ts" qlobal `Request`/`FormData`-nı şərti elan edir.
// Layihənin @types/* yığını ilə birgə `Request.formData()` qaytarış tipi lib.dom
// FormData üzvlərini (get/getAll/has/set/...) İTİRİR → 8 upload route-da build sınır
// ("Property 'get' does not exist on type 'FormData'"). `new FormData()` düzgündür.
//
// Aşağıdakı augmentation qlobal `FormData` üzvlərini bərpa edir VƏ `Request.formData()`-nı
// düzgün FormData qaytaracaq şəkildə düzəldir. Runtime davranış dəyişmir — yalnız tip.
export {};

declare global {
  interface FormData {
    append(name: string, value: string | Blob, fileName?: string): void;
    delete(name: string): void;
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: string | Blob, fileName?: string): void;
  }
  interface Request {
    formData(): Promise<FormData>;
  }
}
