import React, { useState, useRef } from 'react';
import GameCanvas, { GameCanvasHandle } from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameState } from './types';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [feverMode, setFeverMode] = useState(false);
  
  // Ref to communicate with Game Canvas logic
  const gameRef = useRef<GameCanvasHandle>(null);

  const handleStart = () => {
    setGameState(GameState.PLAYING);
  };

  const handleRestart = () => {
    setGameState(GameState.START); // Briefly reset to Start to trigger canvas reset
    setTimeout(() => setGameState(GameState.PLAYING), 10);
  };

  const handleDashTrigger = () => {
    if (gameRef.current) {
      return gameRef.current.triggerDash();
    }
    return false;
  };

  return (
    // Use h-[100dvh] for mobile browsers to handle address bar resizing correctly
    <div className="w-full h-[100dvh] relative flex flex-col bg-slate-900 overflow-hidden touch-none">
      <GameCanvas 
        ref={gameRef}
        gameState={gameState} 
        setGameState={setGameState}
        setScore={setScore}
        setHighScore={setHighScore}
        setFeverMode={setFeverMode}
      />
      <UIOverlay 
        gameState={gameState}
        score={score}
        highScore={highScore}
        feverMode={feverMode}
        onStart={handleStart}
        onRestart={handleRestart}
        onDashTrigger={handleDashTrigger}
      />
    </div>
  );
}

export default App;