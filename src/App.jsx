import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

// --- LOREM IPSUM GENERATOR ---
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

// --- 1. DATA DEFINITION (Updated Sizes) ---
const NODES = [
  // Central Hub - Increased size significantly (Hub = 12)
  { id: 'server', lat: 38.0, lng: -95.0, label: 'My Telth Server', type: 'hub', color: '#d946ef', size: 12 },
  
  // Data Sources - (Size = 4)
  { id: 'twban', lat: 22.0, lng: 79.0, label: 'TWBAN (Patient)', type: 'source', color: '#06b6d4', size: 4 },
  { id: 'home', lat: 55.0, lng: -105.0, label: 'Telth Home', type: 'source', color: '#06b6d4', size: 4 },
  
  // Care Providers - (Size = 4)
  { id: 'doctor', lat: -15.0, lng: -55.0, label: 'Doctor', type: 'provider', color: '#ffffff', size: 4 },
  { id: 'hospital', lat: 50.0, lng: 10.0, label: 'Tertiary Hospital', type: 'provider', color: '#ef4444', size: 5 },
  { id: 'digidoc', lat: 35.0, lng: 135.0, label: 'DigiDoc AI', type: 'provider', color: '#ffffff', size: 4 },
  
  // Logistics - (Size = 3)
  { id: 'pharmacy', lat: 45.0, lng: 25.0, label: 'G-Med ID', type: 'logistics', color: '#eab308', size: 3.5 },
  { id: 'drone', lat: 52.0, lng: 12.0, label: 'T-Chopper', type: 'logistics', color: '#ef4444', size: 3 }, 
  { id: 'ambulance', lat: 48.0, lng: 8.0, label: 'Ambulance', type: 'logistics', color: '#ef4444', size: 3 }, 
  
  // Ecosystem - (Size = 4)
  { id: 'market', lat: 5.0, lng: 20.0, label: 'Telth Market', type: 'ecosystem', color: '#f472b6', size: 4, pipeline: true },
  { id: 'rnd', lat: 52.0, lng: -1.0, label: 'R&D Center', type: 'ecosystem', color: '#4ade80', size: 4 },
];

const ARCS = [
  // Data flowing TO Server
  { source: 'twban', target: 'server', type: 'data' },
  { source: 'home', target: 'server', type: 'data' },
  { source: 'digidoc', target: 'server', type: 'data' },
  { source: 'market', target: 'server', type: 'pipeline' }, 

  // Data flowing FROM Server
  { source: 'server', target: 'doctor', type: 'data' },
  { source: 'server', target: 'hospital', type: 'data' },
  { source: 'server', target: 'pharmacy', type: 'data' },
  { source: 'server', target: 'rnd', type: 'data' },

  // Inter-node connections
  { source: 'doctor', target: 'pharmacy', type: 'data' },
  { source: 'hospital', target: 'drone', type: 'emergency' },
  { source: 'hospital', target: 'ambulance', type: 'emergency' },
  { source: 'twban', target: 'digidoc', type: 'data' },
  { source: 'twban', target: 'pharmacy', type: 'data' },
];


export default function App() {
  const globeEl = useRef();
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      globeEl.current.pointOfView({ altitude: 2.5 });
    }
  }, []);


  // --- LOGIC: Highlight connected nodes & lines ---
  const handleNodeClick = useCallback((node) => {
    const nodeId = node.id;
    const neighbors = new Set();
    neighbors.add(nodeId);

    // Find all connected nodes
    ARCS.forEach(arc => {
      if (arc.source === nodeId) neighbors.add(arc.target);
      if (arc.target === nodeId) neighbors.add(arc.source);
    });

    setHighlightedIds(neighbors);
    setSelectedNodeId(nodeId);

    // Stop rotation and focus
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = false;
      globeEl.current.pointOfView({ lat: node.lat, lng: node.lng, altitude: 2 }, 1000);
    }
  }, []);

  const closeSidebar = () => {
    setSelectedNodeId(null);
    setHighlightedIds(new Set());
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
    }
  };

  // --- 3D MATERIALS ---
  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: 0x000020, transparent: true, opacity: 0.85, shininess: 80
  }), []);

  // --- VISUAL HELPERS ---
  // Is this element hidden? (Only if something is selected AND this element isn't in the set)
  const isDimmed = (id) => selectedNodeId && !highlightedIds.has(id);
  
  // Is this line part of the active path?
  const isArcActive = (arc) => {
    if (!selectedNodeId) return true; // Show all by default
    return highlightedIds.has(arc.source) && highlightedIds.has(arc.target);
  };

  const selectedNodeData = NODES.find(n => n.id === selectedNodeId);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#000000"
        globeMaterial={globeMaterial}
        showAtmosphere={true}
        atmosphereColor="#3a86ff"
        atmosphereAltitude={0.2}

        // --- 3D NODES (BIGGER) ---
        objectsData={NODES}
        objectThreeObject={(d) => {
          // If dimmed, turn off the light
          const intensity = isDimmed(d.id) ? 0.1 : 1.0;
          
          let geometry;
          if (d.type === 'hub') geometry = new THREE.BoxGeometry(d.size, d.size, d.size); // BIG CUBE
          else geometry = new THREE.SphereGeometry(d.size, 32, 32); // BIG SPHERES

          const material = new THREE.MeshPhongMaterial({
            color: d.color,
            emissive: d.color,
            emissiveIntensity: isDimmed(d.id) ? 0 : 0.6,
            transparent: true,
            opacity: isDimmed(d.id) ? 0.2 : 0.9
          });
          return new THREE.Mesh(geometry, material);
        }}
        onObjectClick={handleNodeClick}

        // --- CONNECTIONS (ARCS) ---
        arcsData={ARCS}
        // If no node selected: Show all (semi-transparent). 
        // If node selected: Show only active paths (bright). Hide others.
        arcColor={(d) => {
           const isActive = isArcActive(d);
           const baseColor = d.type === 'pipeline' || d.type === 'emergency' ? '#ef4444' : '#d946ef'; // Red or Purple
           
           if (!selectedNodeId) return d.type === 'pipeline' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(217, 70, 239, 0.5)'; // Default state
           return isActive ? baseColor : 'rgba(0,0,0,0)'; // Highlight or Hide
        }}
        arcDashLength={0.4}
        arcDashGap={(d) => d.type === 'pipeline' ? 0.5 : 0.1}
        arcDashAnimateTime={(d) => d.type === 'pipeline' ? 3000 : 1500} // Speed
        arcStroke={(d) => isArcActive(d) ? 2.5 : 0.5} // Thicker lines
        arcAltitude={(d) => isArcActive(d) ? 0.25 : 0.1} // Pop active lines higher
      />

     {/* WIREFRAME OVERLAY (The "AI Chip" Look) */}
     <div style={{position:'absolute', top:0, left:0, pointerEvents:'none', mixBlendMode:'screen', opacity: 0.3}}>
        <Globe 
           width={dimensions.width}
           height={dimensions.height}
           backgroundColor="rgba(0,0,0,0)"
           showGlobe={false} showAtmosphere={false}
           objectsData={[{id:'wireframe'}]}
           objectLat={0} objectLng={0} objectAltitude={0}
           objectThreeObject={() => {
              const geo = new THREE.WireframeGeometry(new THREE.SphereGeometry(100, 24, 24));
              const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
              return new THREE.LineSegments(geo, mat);
           }}
        />
     </div>

      {/* TITLES */}
      <div style={{ position: 'absolute', top: 30, left: 30, zIndex: 10, pointerEvents: 'none' }}>
        <h1 style={{ color: 'white', fontFamily: 'sans-serif', margin: 0, letterSpacing: '2px', textShadow: '0 0 20px #d946ef' }}>AI HEALTH GRID</h1>
        <p style={{ color: '#06b6d4', fontFamily: 'sans-serif', margin: '5px 0 0 0', fontSize: '14px' }}>REAL-TIME ECOSYSTEM MONITORING</p>
      </div>

      {/* SIDEBAR */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: selectedNodeId ? '400px' : '0',
        background: 'rgba(5, 5, 20, 0.95)',
        borderLeft: `2px solid ${selectedNodeData?.color || '#333'}`,
        transition: 'all 0.4s ease',
        color: 'white', fontFamily: 'sans-serif', overflow: 'hidden', zIndex: 20
      }}>
        {selectedNodeData && (
          <div style={{ padding: '40px' }}>
            <button onClick={closeSidebar} style={{ float: 'right', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
            <h2 style={{ fontSize: '32px', color: selectedNodeData.color, marginTop: 0 }}>{selectedNodeData.label}</h2>
            <div style={{ fontSize: '12px', letterSpacing: '1.5px', color: '#888', marginBottom: '30px' }}>
              TYPE: {selectedNodeData.type.toUpperCase()}
            </div>

            <p style={{ lineHeight: '1.8', color: '#ccc' }}>{LOREM}</p>
            
            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: selectedNodeData.color }}>Connections</h4>
              <ul style={{ paddingLeft: '20px', color: '#aaa', lineHeight: '1.6' }}>
                {Array.from(highlightedIds).map(id => {
                  if (id === selectedNodeData.id) return null;
                  const n = NODES.find(node => node.id === id);
                  return <li key={id}>{n?.label}</li>
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}