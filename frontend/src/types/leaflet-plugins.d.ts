import 'leaflet';
import 'leaflet.markercluster';
import 'leaflet-draw';
import 'leaflet.heat';

declare module 'leaflet' {
  export interface MarkerClusterGroupOptions {
    maxClusterRadius?: number;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon | L.DivIcon;
  }

  export interface MarkerCluster extends L.Marker {
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
  }

  export class MarkerClusterGroup extends L.FeatureGroup {
    constructor(options?: MarkerClusterGroupOptions);
  }

  export function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;

  export function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      gradient?: Record<number, string>;
    }
  ): L.Layer;

  export namespace Control {
    class Draw extends L.Control {
      constructor(options?: DrawConstructorOptions);
    }
  }

  export interface DrawConstructorOptions {
    position?: L.ControlPosition;
    draw?: DrawOptions;
    edit?: EditOptions;
  }

  export interface DrawOptions {
    polygon?: DrawPolygonOptions | false;
    circle?: DrawCircleOptions | false;
    rectangle?: DrawRectangleOptions | false;
    circlemarker?: DrawCircleMarkerOptions | false;
    marker?: DrawMarkerOptions | false;
    polyline?: DrawPolylineOptions | false;
  }

  export interface DrawPolygonOptions {
    allowIntersection?: boolean;
    shapeOptions?: L.PathOptions;
  }

  export interface DrawCircleOptions {
    shapeOptions?: L.PathOptions;
  }

  export interface DrawRectangleOptions {
    shapeOptions?: L.PathOptions;
  }

  export interface DrawCircleMarkerOptions {
    shapeOptions?: L.PathOptions;
  }

  export interface DrawMarkerOptions {
    icon?: L.Icon;
  }

  export interface DrawPolylineOptions {
    shapeOptions?: L.PathOptions;
  }

  export interface EditOptions {
    featureGroup: L.FeatureGroup;
  }

  export namespace Draw {
    namespace Event {
      const CREATED: string;
    }
  }
}
