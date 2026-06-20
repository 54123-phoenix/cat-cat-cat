/// <reference types="vite/client" />

declare namespace AMap {
  class Map {
    constructor(container: string | HTMLElement, opts?: any);
    setCenter(pos: [number, number]): void;
    setZoom(zoom: number): void;
    setMapStyle(style: string): void;
    add(marker: any): void;
    remove(marker: any): void;
    clearMap(): void;
    destroy(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    getCenter(): any;
  }
  class Marker {
    constructor(opts?: any);
    setPosition(pos: [number, number]): void;
    setLabel(label: any): void;
    on(event: string, handler: (...args: any[]) => void): void;
  }
  class InfoWindow {
    constructor(opts?: any);
    open(map: Map, pos: [number, number]): void;
    close(): void;
    setContent(content: string): void;
  }
  class Geolocation {
    constructor(opts?: any);
    getCurrentPosition(callback: (status: string, result: any) => void): void;
  }
  class Scale {}
}

interface ImportMetaEnv {
  readonly VITE_AMAP_KEY: string;
  readonly VITE_API_TARGET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
