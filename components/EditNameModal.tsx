import React, { useState } from 'react';
import { X, Save, Loader2, Edit2 } from 'lucide-react';

interface EditNameModalProps {
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => Promise<boolean>;
}

const EditNameModal: React.FC<EditNameModalProps> = ({ currentName, onClose, onSave }) => {
  const [name, setName] = useState(currentName === 'Anonymous' ? '' : currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      setError('Name cannot be empty');
      return;
    }
    
    if (trimmed.length > 12) {
      setError('Name too long (max 12 chars)');
      return;
    }

    if (trimmed === currentName) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError('');
    
    const success = await onSave(trimmed);
    
    setIsLoading(false);
    if (!success) {
      setError('Name taken or error occurred. Try another.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#14171c] to-[#0c0e12] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Edit2 className="text-game-blue" size={20} />
            <h3 className="text-xl font-bold text-white">Edit Name</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={12}
              className="w-full bg-[#1a1d23] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-game-blue transition-colors text-center font-bold text-lg"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mt-2 text-center font-semibold">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-game-blue to-blue-500 text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {isLoading ? 'Saving...' : 'Save Name'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditNameModal;