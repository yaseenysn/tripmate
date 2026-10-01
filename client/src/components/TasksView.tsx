import React, { useState } from 'react';
import { CheckSquare, Plus, Trash2, Clock, ShieldAlert } from 'lucide-react';
import { apiCreateTask, apiUpdateTask, apiDeleteTask } from '../services/api';

interface TasksViewProps {
  tripId: string;
  tasks: any[];
  members: any[];
  openAddModal?: boolean;
  onRefresh: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tripId,
  tasks,
  members,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);

  React.useEffect(() => {
    if (openAddModal) setShowAddModal(true);
  }, [openAddModal]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [loading, setLoading] = useState(false);

  const filteredTasks = statusFilter === 'ALL'
    ? tasks
    : tasks.filter(t => t.status === statusFilter);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setLoading(true);
    try {
      await apiCreateTask(tripId, {
        title,
        description,
        assignedTo: assignedTo || undefined,
        priority
      });
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTaskStatus = async (task: any) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : task.status === 'TODO' ? 'IN_PROGRESS' : 'DONE';
    try {
      await apiUpdateTask(tripId, task._id, { status: nextStatus });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await apiDeleteTask(tripId, id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
            Trip Preparation Tasks
          </span>
          <h2 className="text-xl font-bold text-slate-100">{tasks.length} Total Tasks</h2>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center">
          <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No tasks found</h3>
          <p className="text-xs text-slate-500 mt-1">Assign tasks to trip members so everyone stays prepared.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const isDone = task.status === 'DONE';
            const assignee = task.assignedTo;

            return (
              <div key={task._id} className="glass-card p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-indigo-400'
                      }`}
                  >
                    {isDone && <CheckSquare className="w-3.5 h-3.5" />}
                  </button>

                  <div className="min-w-0">
                    <h4 className={`font-bold text-sm ${isDone ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      <span className={`px-2 py-0.5 rounded font-bold ${task.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : task.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                        {task.priority}
                      </span>
                      {assignee && (
                        <span>Assigned to <strong className="text-slate-200">{assignee.name}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Create Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Book Hotel, Confirm Cab"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Assign To
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => {
                      const u = m.user || m.userId;
                      return <option key={u._id} value={u._id}>{u.name}</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
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
                  className="flex-1 bg-amber-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
