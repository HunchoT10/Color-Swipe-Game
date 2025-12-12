import React from 'react';
import { X } from 'lucide-react';

interface InstructionsProps {
  onClose: () => void;
}

const Instructions: React.FC<InstructionsProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d23] border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        
        <h3 className="text-2xl font-bold text-game-green mb-6 text-center">How to Play</h3>
        
        <p className="text-gray-300 text-center mb-6">
          Match the <span className="font-bold text-white">BLOCK COLOR</span> to the correct direction. Ignore the text!
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-lg font-bold">
          <div className="bg-game-dark p-3 rounded-lg border border-white/5 flex items-center gap-2 text-white">
            <span className="w-4 h-4 rounded-full bg-red-500 block"></span> UP
          </div>
          <div className="bg-game-dark p-3 rounded-lg border border-white/5 flex items-center gap-2 text-white">
            <span className="w-4 h-4 rounded-full bg-green-500 block"></span> DOWN
          </div>
          <div className="bg-game-dark p-3 rounded-lg border border-white/5 flex items-center gap-2 text-white">
            <span className="w-4 h-4 rounded-full bg-blue-500 block"></span> LEFT
          </div>
          <div className="bg-game-dark p-3 rounded-lg border border-white/5 flex items-center gap-2 text-white">
            <span className="w-4 h-4 rounded-full bg-yellow-400 block"></span> RIGHT
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default Instructions;