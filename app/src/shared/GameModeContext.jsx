import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GameModeContext = createContext({ gameMode: 'engaged', updateGameMode: () => {} });

export function GameModeProvider({ organizationId, children }) {
  const [gameMode, setGameMode] = useState('engaged');

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('organizations')
      .select('game_mode')
      .eq('id', organizationId)
      .single()
      .then(({ data }) => {
        if (data?.game_mode) setGameMode(data.game_mode);
      });
  }, [organizationId]);

  const updateGameMode = async (mode) => {
    setGameMode(mode);
    if (!organizationId) return;
    await supabase
      .from('organizations')
      .update({ game_mode: mode })
      .eq('id', organizationId);
  };

  return (
    <GameModeContext.Provider value={{ gameMode, updateGameMode }}>
      {children}
    </GameModeContext.Provider>
  );
}

export const useGameMode = () => useContext(GameModeContext);
