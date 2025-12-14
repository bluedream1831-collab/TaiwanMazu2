import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { DASH_COOLDOWN_MS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  score: number;
  highScore: number;
  feverMode: boolean;
  onStart: () => void;
  onRestart: () => void;
  onDashTrigger: () => boolean; // Returns true if dash successful
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, score, highScore, feverMode, onStart, onRestart, onDashTrigger
}) => {
  const [dashCooldown, setDashCooldown] = useState(0); // 0 to 100 percentage

  // Keyboard shortcut for dash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === GameState.PLAYING) {
        handleDash();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, dashCooldown]);

  const handleDash = () => {
    if (dashCooldown > 0) return;
    
    if (onDashTrigger()) {
      setDashCooldown(100);
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = DASH_COOLDOWN_MS - elapsed;
        if (remaining <= 0) {
          setDashCooldown(0);
          clearInterval(interval);
        } else {
          setDashCooldown((remaining / DASH_COOLDOWN_MS) * 100);
        }
      }, 50);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col z-10 overflow-hidden">
      
      {/* 1. HUD (Safe Area Aware) */}
      <div className="flex justify-between items-start w-full p-4 pl-safe pr-safe pt-safe">
        <div className={`transition-all duration-300 px-4 py-2 rounded-full border-2 shadow-sm flex items-center gap-2 ${feverMode ? 'bg-yellow-500 border-red-500 scale-105' : 'bg-white/90 border-pink-400'}`}>
           <span className="text-2xl">🏮</span>
           <div>
             <p className={`text-lg font-black leading-none ${feverMode ? 'text-red-900' : 'text-pink-600'}`}>
               {score}
             </p>
             {feverMode && <p className="text-[10px] font-bold text-red-800 animate-pulse leading-none mt-1">鑽轎底！</p>}
           </div>
        </div>
        
        <div className="bg-white/90 px-3 py-1 rounded-full border-2 border-yellow-400 shadow-sm flex flex-col items-center">
          <p className="text-[10px] font-bold text-yellow-700 uppercase leading-none">High Score</p>
          <p className="text-lg font-black text-yellow-600 leading-none">{highScore}</p>
        </div>
      </div>

      {/* 2. Action Buttons (Dash - Optimized for Right Thumb) */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-6 right-6 pr-safe pb-safe pointer-events-auto touch-manipulation">
          <button 
            onClick={handleDash}
            disabled={dashCooldown > 0}
            className={`
              w-24 h-24 rounded-full border-4 shadow-2xl flex flex-col items-center justify-center
              transition-transform duration-100 active:scale-90 relative overflow-hidden group
              ${dashCooldown > 0 
                ? 'bg-slate-600 border-slate-500 opacity-80' 
                : 'bg-gradient-to-br from-cyan-400 to-blue-600 border-white ring-4 ring-black/10'}
            `}
          >
            {/* Cooldown Visual */}
            {dashCooldown > 0 && (
              <div 
                className="absolute bottom-0 left-0 right-0 bg-black/50 transition-[height] ease-linear" 
                style={{ height: `${dashCooldown}%` }}
              />
            )}
            
            <span className="text-3xl font-black text-white drop-shadow-md z-20 group-active:translate-y-1 transition-transform">
              衝
            </span>
            {dashCooldown === 0 && (
              <span className="text-[10px] text-cyan-100 font-bold uppercase tracking-widest mt-1">Dash</span>
            )}
          </button>
        </div>
      )}

      {/* 3. Controls Hint (Left Side - Desktop only) */}
      {gameState === GameState.PLAYING && (
        <div className="absolute left-4 bottom-1/2 translate-y-1/2 pointer-events-none opacity-30 hidden md:block">
           <div className="flex flex-col items-center gap-2">
             <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center text-white">▲</div>
             <div className="text-white text-xs font-bold">MOVE</div>
             <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center text-white">▼</div>
           </div>
        </div>
      )}

      {/* 4. Start Screen (Detailed Instructions) */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto backdrop-blur-sm z-40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col border-4 border-pink-400">
            
            {/* Header */}
            <div className="bg-pink-50 p-4 flex flex-col items-center justify-center text-center border-b-2 border-pink-100 shrink-0">
               <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500 drop-shadow-sm">
                 粉紅超跑：數位遶境
               </h1>
               <p className="text-pink-800 font-bold text-sm mt-1">全台瘋媽祖，指尖求平安</p>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
               
               {/* Controls Section */}
               <div className="mb-6">
                 <h3 className="font-black text-gray-800 text-lg mb-3 flex items-center">
                   <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm">🎮</span>
                   操作方式
                 </h3>
                 <div className="flex gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl flex-1 flex flex-col items-center text-center border border-gray-100">
                       <span className="text-2xl mb-1">👆</span>
                       <span className="font-bold text-sm text-gray-700">上下滑動</span>
                       <span className="text-xs text-gray-500">控制轎子移動</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl flex-1 flex flex-col items-center text-center border border-gray-100">
                       <span className="text-2xl mb-1">⚡</span>
                       <span className="font-bold text-sm text-gray-700">衝刺按鈕</span>
                       <span className="text-xs text-gray-500">短暫無敵加速</span>
                    </div>
                 </div>
               </div>

               {/* Items Guide Grid */}
               <div className="mb-6">
                 <h3 className="font-black text-gray-800 text-lg mb-3 flex items-center">
                   <span className="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm">✨</span>
                   進香圖鑑
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Score Items */}
                    <div className="flex items-center p-2 bg-pink-50 rounded-lg border border-pink-100">
                       <div className="text-2xl mr-3">🏮</div>
                       <div>
                         <p className="font-bold text-sm text-pink-900">祈福物品</p>
                         <p className="text-xs text-pink-700">燈籠/壽桃/紅包 (+10分)</p>
                       </div>
                    </div>
                    {/* Supply Items */}
                    <div className="flex items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                       <div className="text-2xl mr-3">🍉</div>
                       <div>
                         <p className="font-bold text-sm text-blue-900">結緣點心</p>
                         <p className="text-xs text-blue-700">西瓜/飲料/飯糰 (+5分 & 減速喘口氣)</p>
                       </div>
                    </div>
                    {/* Fever Item */}
                    <div className="flex items-center p-2 bg-yellow-50 rounded-lg border border-yellow-100 col-span-1 md:col-span-2">
                       <div className="text-2xl mr-3">🔥</div>
                       <div>
                         <p className="font-bold text-sm text-yellow-900">神轎香爐</p>
                         <p className="text-xs text-yellow-700">觸發「鑽轎底」模式！全速無敵衝刺，信徒跪拜 (+20分)</p>
                       </div>
                    </div>
                    {/* Obstacles */}
                    <div className="flex items-center p-2 bg-gray-100 rounded-lg border border-gray-200 col-span-1 md:col-span-2">
                       <div className="text-2xl mr-3">🚧</div>
                       <div>
                         <p className="font-bold text-sm text-gray-800">小心障礙</p>
                         <p className="text-xs text-gray-600">炮仗與路障。撞到會結束遊戲！<br/><span className="text-red-500 font-bold">小撇步：衝刺或鑽轎底時可撞飛障礙物</span></p>
                       </div>
                    </div>
                 </div>
               </div>

            </div>

            {/* Footer / Start Button */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0 z-10">
              <button 
                onClick={onStart}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-600 text-white font-black text-xl rounded-2xl shadow-lg active:scale-95 transition-all animate-bounce-slow flex items-center justify-center gap-2"
              >
                <span>🚀</span> 起駕出發
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-auto backdrop-blur-sm z-40">
           <div className="bg-white p-6 rounded-3xl shadow-2xl text-center border-4 border-gray-300 max-w-sm w-[85%]">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2">駐駕休息</h2>
            <p className="text-gray-500 mb-6 font-medium">媽祖婆累了，喝口茶再走。</p>
            
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-2xl mb-8 border border-pink-200">
              <p className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-1">本次福氣值</p>
              <p className="text-6xl font-black text-pink-600">{score}</p>
            </div>

            <button 
              onClick={onRestart}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-2xl text-xl shadow-lg active:scale-95 transition-all"
            >
              繼續進香 ➜
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;