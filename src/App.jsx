import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.";

// --- 1. THE NODES ---
const NODES = [
  { id: 'server', lat: 38.0, lng: -95.0, label: 'My Telth Server', type: 'hub', color: '#d946ef', size: 10 },
  { id: 'twban', lat: 22.0, lng: 79.0, label: 'TWBAN (Patient)', type: 'sensor', color: '#06b6d4', size: 3 },
  { id: 'home', lat: 55.0, lng: -105.0, label: 'Telth Home', type: 'home', color: '#06b6d4', size: 5 },
  { id: 'doctor', lat: -15.0, lng: -55.0, label: 'Doctor', type: 'human', color: '#ffffff', size: 4 },
  { id: 'hospital', lat: 50.0, lng: 10.0, label: 'Tertiary Hospital', type: 'hospital', color: '#ef4444', size: 6 },
  { id: 'digidoc', lat: 35.0, lng: 135.0, label: 'DigiDoc AI', type: 'server_small', color: '#ffffff', size: 4 },
  { id: 'pharmacy', lat: 45.0, lng: 25.0, label: 'Pharmacy', type: 'building', color: '#eab308', size: 4 },
  { id: 'drone', lat: 52.0, lng: 12.0, label: 'T-Chopper', type: 'drone', color: '#ef4444', size: 3 }, 
  { id: 'ambulance', lat: 48.0, lng: 8.0, label: 'Ambulance', type: 'vehicle', color: '#ef4444', size: 3 }, 
  { id: 'market', lat: 5.0, lng: 20.0, label: 'Telth Market', type: 'building', color: '#f472b6', size: 4 },
  { id: 'rnd', lat: 52.0, lng: -1.0, label: 'R&D Center', type: 'factory', color: '#4ade80', size: 5 },
];

// --- 2. THE CONNECTIONS (Universal List) ---
const ARCS = [
  { source: 'twban', target: 'server' },
  { source: 'home', target: 'server' },
  { source: 'digidoc', target: 'server' },
  { source: 'market', target: 'server' }, 
  { source: 'server', target: 'doctor' },
  { source: 'server', target: 'hospital' },
  { source: 'server', target: 'pharmacy' },
  { source: 'server', target: 'rnd' },
  { source: 'doctor', target: 'pharmacy' },
  { source: 'hospital', target: 'drone' },
  { source: 'hospital', target: 'ambulance' },
  { source: 'twban', target: 'digidoc' },
];

// --- 3. SEQUENCE DEFINITIONS (YOU EDIT THIS) ---
// This defines the "Constellation" order. 
// When user clicks 'twban', we light up Server, then Hospital, then Drone.
const SEQUENCES = {
  'twban': ['twban', 'server', 'hospital', 'drone'], // Emergency Flow
  'home': ['home', 'server', 'doctor', 'pharmacy'], // Tele-health Flow
  'server': ['server', 'rnd', 'digidoc'], // Data Sync Flow
  'hospital': ['hospital', 'ambulance', 'server'], // Emergency Response
  'doctor': ['doctor', 'pharmacy', 'server'] // Prescription Flow
};

// --- 3D UTILS ---
const createServerIcon = (color, size) => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(size, size*1.5, size), new THREE.MeshPhongMaterial({color, transparent:true, opacity:0.9})));
  return g;
};
const createSimpleSphere = (color, size) => new THREE.Mesh(new THREE.SphereGeometry(size), new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));


export default function App() {
  const globeEl = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  // --- ANIMATION STATE ---
  const [activeSequence, setActiveSequence] = useState([]); // The full path we want to show
  const [visibleStep, setVisibleStep] = useState(0); // How far we are in that path (0, 1, 2...)
  const [selectedNodeData, setSelectedNodeData] = useState(null);

  // Resize handler
  useEffect(() => {
    window.addEventListener('resize', () => setDimensions({ width: window.innerWidth, height: window.innerHeight }));
  }, []);

  // --- THE SEQUENCER ENGINE ---
  useEffect(() => {
    let interval;
    if (activeSequence.length > 0 && visibleStep < activeSequence.length - 1) {
      // Every 800ms, reveal the next node/line in the list
      interval = setInterval(() => {
        setVisibleStep(prev => prev + 1);
      }, 800);
    }
    return () => clearInterval(interval);
  }, [activeSequence, visibleStep]);


  // --- CLICK HANDLER ---
  const handleNodeClick = useCallback((node) => {
    const nodeId = node.id;
    
    // 1. Look up the predefined sequence for this node
    const sequence = SEQUENCES[nodeId];

    if (sequence) {
      // If a sequence exists, start the animation
      setActiveSequence(sequence);
      setVisibleStep(0); // Start at the beginning
      setSelectedNodeData(node);
      
      // Stop Globe and Focus
      if (globeEl.current) {
        globeEl.current.controls().autoRotate = false;
        globeEl.current.pointOfView({ lat: node.lat, lng: node.lng, altitude: 2.2 }, 1000);
      }
    } else {
      // Fallback if no sequence defined: just show the node info
      setActiveSequence([]);
      setSelectedNodeData(node);
    }
  }, []);

  const closeSidebar = () => {
    setSelectedNodeData(null);
    setActiveSequence([]); // Reset animation
    setVisibleStep(0);
    if (globeEl.current) globeEl.current.controls().autoRotate = true;
  };


  // --- VISUAL LOGIC ---

  // Check if a node is part of the CURRENTLY REVEALED steps
  const isNodeRevealed = (nodeId) => {
    if (activeSequence.length === 0) return true; // Show all if nothing active (or return false to hide)
    const index = activeSequence.indexOf(nodeId);
    return index !== -1 && index <= visibleStep;
  };

  // Check if a line (arc) connects two nodes that are BOTH currently revealed
  // AND represent a direct step in the sequence (i.e., Step 1 connects to Step 2)
  const isPathRevealed = (arc) => {
    if (activeSequence.length === 0) return false; // Hide surface paths by default
    
    const srcIndex = activeSequence.indexOf(arc.source);
    const tgtIndex = activeSequence.indexOf(arc.target);

    // If both nodes are in the sequence
    if (srcIndex !== -1 && tgtIndex !== -1) {
      // Check if they are visible yet
      if (srcIndex <= visibleStep && tgtIndex <= visibleStep) {
         // Check if they are adjacent in the sequence (Line by Line logic)
         // e.g. Sequence is [A, B, C]. We want line A-B, then B-C. Not A-C.
         const distance = Math.abs(srcIndex - tgtIndex);
         return distance === 1; 
      }
    }
    return false;
  };


  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden', position: 'relative' }}>
      
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#000000"
        globeMaterial={new THREE.MeshPhongMaterial({ color: 0x000020, transparent: true, opacity: 0.85, shininess: 80 })}
        showAtmosphere={true}
        atmosphereColor="#3a86ff"
        atmosphereAltitude={0.2}

        // --- 1. NODES ---
        objectsData={NODES}
        objectThreeObject={(d) => {
          // If a sequence is running, dim nodes that haven't appeared yet
          const revealed = activeSequence.length === 0 || isNodeRevealed(d.id);
          
          let obj = d.type === 'hub' ? createServerIcon(d.color, d.size) : createSimpleSphere(d.color, d.size);
          
          if (!revealed) {
             obj.traverse(c => { if(c.isMesh) { c.material.opacity = 0.1; c.material.transparent=true; c.material.emissiveIntensity=0; }});
          } else {
             // Highlight the "just added" node
             const isNewest = activeSequence[visibleStep] === d.id;
             if(isNewest) obj.traverse(c => { if(c.isMesh) c.material.emissiveIntensity = 1; });
          }
          return obj;
        }}
        onObjectClick={handleNodeClick}

        // --- 2. SURFACE PATHS (The "Constellation" Lines) ---
        // These ONLY appear when active, step-by-step
        pathsData={ARCS}
        pathPoints={d => {
           const s = NODES.find(n => n.id === d.source);
           const t = NODES.find(n => n.id === d.target);
           return [[s.lat, s.lng], [t.lat, t.lng]];
        }}
        pathColor={d => isPathRevealed(d) ? '#00e5ff' : 'rgba(0,0,0,0)'} // Cyan if revealed, Transparent if not
        pathDashLength={0.1}
        pathDashGap={0.05}
        pathDashAnimateTime={isPathRevealed} // Animate only if revealed
        pathStroke={2}
        pathPointAlt={0.02}

        // --- 3. FLYING ARCS (The Default Data Layer) ---
        // These are visible by default but fade out when a sequence takes over
        arcsData={ARCS}
        arcColor={d => {
           if (activeSequence.length > 0) return 'rgba(0,0,0,0)'; // Hide flying lines when zooming in on surface
           return 'rgba(217, 70, 239, 0.4)'; // Default Purple
        }}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        arcStroke={0.5}
      />

      {/* TITLES */}
      <div style={{ position: 'absolute', top: 30, left: 30, zIndex: 10, pointerEvents: 'none' }}>
        <h1 style={{ color: 'white', fontFamily: 'sans-serif', margin: 0, letterSpacing: '2px', textShadow: '0 0 20px #d946ef' }}>AI HEALTH GRID</h1>
        <p style={{ color: '#06b6d4', fontFamily: 'sans-serif', margin: '5px 0 0 0', fontSize: '14px' }}>SEQUENCED CONNECTION PROTOCOL</p>
      </div>

      {/* SIDEBAR */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: selectedNodeData ? '400px' : '0',
        background: 'rgba(5, 5, 20, 0.95)',
        borderLeft: '1px solid #333',
        transition: 'all 0.4s ease',
        color: 'white', fontFamily: 'sans-serif', overflow: 'hidden', zIndex: 20
      }}>
        {selectedNodeData && (
          <div style={{ padding: '40px' }}>
            <button onClick={closeSidebar} style={{ float: 'right', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
            <h2 style={{ fontSize: '32px', color: selectedNodeData.color, marginTop: 0 }}>{selectedNodeData.label}</h2>
            
            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#00e5ff' }}>Transmission Sequence</h4>
              
              {/* This list builds itself as the animation runs */}
              <ul style={{ paddingLeft: '0', listStyle:'none' }}>
                {activeSequence.map((stepId, index) => {
                  if (index > visibleStep) return null; // Don't show future steps
                  const node = NODES.find(n => n.id === stepId);
                  const isLast = index === activeSequence.length -1;
                  
                  return (
                    <li key={stepId} style={{ 
                      marginBottom: '10px', 
                      display: 'flex', 
                      alignItems: 'center',
                      opacity: index === visibleStep ? 1 : 0.5, // Highlight current step
                      transform: index === visibleStep ? 'translateX(5px)' : 'translateX(0)',
                      transition: 'all 0.3s'
                    }}>
                      <span style={{ 
                        width: '20px', height: '20px', 
                        borderRadius: '50%', 
                        background: node.color,
                        marginRight: '10px',
                        display: 'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'black', fontWeight:'bold'
                      }}>{index + 1}</span>
                      {node.label}
                      {index < visibleStep && !isLast && <div style={{marginLeft:'auto', color:'#00e5ff'}}>↓</div>}
                    </li>
                  );
                })}
              </ul>
              
              {activeSequence.length === 0 && <p style={{color:'#666'}}>No specific sequence defined for this node.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}