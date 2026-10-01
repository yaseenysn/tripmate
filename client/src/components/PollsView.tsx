import React, { useState } from 'react';
import { Vote, Plus, CheckCircle2, User } from 'lucide-react';
import { apiCreatePoll, apiVotePoll } from '../services/api';

interface PollsViewProps {
  tripId: string;
  polls: any[];
  currentUser: any;
  openAddModal?: boolean;
  onRefresh: () => void;
}

export const PollsView: React.FC<PollsViewProps> = ({
  tripId,
  polls,
  currentUser,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);

  React.useEffect(() => {
    if (openAddModal) setShowAddModal(true);
  }, [openAddModal]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['Option 1', 'Option 2']);
  const [loading, setLoading] = useState(false);

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      await apiVotePoll(tripId, pollId, optionId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim().length > 0);
    if (!question || validOptions.length < 2) return;

    setLoading(true);
    try {
      await apiCreatePoll(tripId, {
        question,
        options: validOptions
      });
      setShowAddModal(false);
      setQuestion('');
      setOptions(['Option 1', 'Option 2']);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block mb-1">
            Group Decision Polls
          </span>
          <h2 className="text-xl font-bold text-slate-100">{polls.length} Active Polls</h2>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Poll</span>
        </button>
      </div>

      {polls.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center">
          <Vote className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No polls yet</h3>
          <p className="text-xs text-slate-500 mt-1">Make group decisions on restaurants, hotels, or activities together.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map(poll => (
            <div key={poll._id} className="glass-card p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-100 text-base">{poll.question}</h4>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                  {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                </span>
              </div>

              <div className="space-y-2">
                {poll.options.map((opt: any) => {
                  const isVoted = poll.userVotedOptionId === opt._id;

                  return (
                    <div
                      key={opt._id}
                      onClick={() => handleVote(poll._id, opt._id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${isVoted
                          ? 'bg-rose-500/10 border-rose-500/50'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                        }`}
                    >
                      {/* Percentage Bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-rose-500/15 transition-all duration-500"
                        style={{ width: `${opt.percentage}%` }}
                      />

                      <div className="relative z-10 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200 flex items-center gap-2">
                          {isVoted && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
                          {opt.text}
                        </span>
                        <span className="font-bold text-slate-300">{opt.percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Create Group Poll</h3>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Question *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Where should we have dinner?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Poll Options *
                </label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[idx] = e.target.value;
                        setOptions(newOpts);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                    />
                  ))}
                  {options.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setOptions([...options, `Option ${options.length + 1}`])}
                      className="text-xs text-rose-400 font-semibold hover:underline block"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 text-xs font-semibold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-rose-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Save Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
