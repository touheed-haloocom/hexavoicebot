import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { BotStatus } from '../types';
import type { Group, AnimationAction } from 'three';

// This is the main component that will be exported
interface HexaCharacterProps {
  status: BotStatus;
  onClick: () => void;
}

const AVATAR_URL = 'https://models.readyplayer.me/65705572352a3630658a2d18.glb';

// The actual 3D model rendering component
function Avatar({ status }: { status: BotStatus }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(AVATAR_URL);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // Stop all other animations before playing the new one.
    Object.values(actions).forEach(action => action?.stop());

    const isSpeaking = status === BotStatus.SPEAKING || status === BotStatus.THINKING;

    // Use a more robust, case-insensitive search for animations.
    const idleAction = Object.values(actions).find(
      (action: AnimationAction | null) => action?.getClip().name.toLowerCase().includes('idle')
    );
    const talkAction = Object.values(actions).find(
      (action: AnimationAction | null) => action?.getClip().name.toLowerCase().includes('talk')
    );

    let actionToPlay = isSpeaking ? talkAction : idleAction;

    // As a fallback, if no specific idle/talk animation is found, play the first animation.
    if (!actionToPlay) {
      actionToPlay = Object.values(actions)[0];
    }
    
    if (actionToPlay) {
        actionToPlay.play();
    }

  }, [status, actions]);

  return (
    <group ref={group} dispose={null}>
      {/* We scale and position the model to be a bust shot */}
      <primitive object={scene} scale={1.8} position={[0, -1.6, 0]} />
    </group>
  );
}
// Preload the model so it's ready when the component mounts
useGLTF.preload(AVATAR_URL);


export const HexaCharacter: React.FC<HexaCharacterProps> = ({ status, onClick }) => {
  const getGlowColor = () => {
    switch(status) {
      case BotStatus.LISTENING:
        return 'rgba(0, 255, 255, 0.7)'; // Cyan for listening
      case BotStatus.SPEAKING:
        return 'rgba(192, 38, 211, 0.7)'; // Fuchsia for speaking
      case BotStatus.THINKING:
        return 'rgba(250, 204, 21, 0.7)'; // Yellow for thinking
      case BotStatus.CONNECTING:
          return 'rgba(255, 255, 255, 0.5)'; // White for connecting
      default:
        return 'rgba(0, 255, 255, 0.4)'; // Default cyan glow
    }
  }

  return (
    <div 
      className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={status === BotStatus.IDLE ? "Start conversation" : "Stop conversation"}
    >
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-500 ${status === BotStatus.LISTENING || status === BotStatus.THINKING ? 'animate-pulse-glow' : ''}`}
        style={{
          boxShadow: `0 0 40px 10px ${getGlowColor()}`,
          filter: `blur(5px)`, // Soften the glow effect
        }}
      />
      <Canvas 
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        style={{ borderRadius: '50%', background: 'transparent' }}
        shadows
      >
        <ambientLight intensity={1.5} />
        <directionalLight 
          position={[3, 3, 5]} 
          intensity={2.5} 
          castShadow 
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <Avatar status={status} />
        </Suspense>
      </Canvas>
    </div>
  );
};