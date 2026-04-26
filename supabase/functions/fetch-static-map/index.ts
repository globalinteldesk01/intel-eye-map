import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert lat/lon to tile coordinates
function latLonToTile(lat: number, lon: number, zoom: number) {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

// Calculate bounding box for ESRI export
function getBoundingBox(lat: number, lon: number, zoom: number, width: number, height: number) {
  // Approximate meters per pixel at equator for each zoom level
  const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  
  const halfWidthMeters = (width / 2) * metersPerPixel;
  const halfHeightMeters = (height / 2) * metersPerPixel;
  
  // Convert to degrees (approximate)
  const latOffset = halfHeightMeters / 111320;
  const lonOffset = halfWidthMeters / (111320 * Math.cos(lat * Math.PI / 180));
  
  return {
    xmin: lon - lonOffset,
    ymin: lat - latOffset,
    xmax: lon + lonOffset,
    ymax: lat + latOffset,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user to prevent abuse as open proxy
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const zoom = parseInt(url.searchParams.get('zoom') || '8');
    const width = parseInt(url.searchParams.get('width') || '600');
    const height = parseInt(url.searchParams.get('height') || '300');
    const mapType = url.searchParams.get('maptype') || 'standard'; // 'standard' or 'satellite'

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ error: 'Missing lat or lon parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate bounding box for ESRI export
    const bbox = getBoundingBox(lat, lon, zoom, width, height);
    
    // Use ESRI services for both map types (more reliable than OSM static)
    const esriService = mapType === 'satellite' 
      ? 'World_Imagery'
      : 'World_Street_Map';
    
    const mapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/${esriService}/MapServer/export?` +
      `bbox=${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}` +
      `&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png&f=image`;
    
    console.log(`Fetching ${mapType} map from ESRI:`, mapUrl);
    
    const response = await fetch(mapUrl);
    
    if (!response.ok) {
      console.error('Map service error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch map from service' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return new Response(
      JSON.stringify({ 
        image: `data:image/png;base64,${base64Image}`,
        mapType,
        success: true 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        } 
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching map:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
