declare namespace wasm_bindgen {
    /* tslint:disable */
    /* eslint-disable */

    export function fsuCalculateChemistry(request_json: string): string;

    export function fsuGenerateCandidateOptions(request_json: string): string;

    export function fsuNeedRatingsCount(request_json: string): string;

    export function fsuPriceLastDiff(purchase_price: number, last_price: number): string;

    export function fsuTeamRatingCount(ratings: Int32Array): number;

    export function fsuWasmVersion(): string;

}
declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly fsuCalculateChemistry: (a: number, b: number) => [number, number, number, number];
    readonly fsuGenerateCandidateOptions: (a: number, b: number) => [number, number, number, number];
    readonly fsuNeedRatingsCount: (a: number, b: number) => [number, number, number, number];
    readonly fsuPriceLastDiff: (a: number, b: number) => [number, number];
    readonly fsuTeamRatingCount: (a: number, b: number) => number;
    readonly fsuWasmVersion: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
