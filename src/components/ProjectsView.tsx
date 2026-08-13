import React, { useMemo, useState } from 'react';
import { Search, Plus, Trash2, ChevronDown } from 'lucide-react';
import type { Project } from '../types';
import { t } from '../i18n';

type Sort = 'updated' | 'name';

/** Card grid, not a list -- projects are containers (name + description),
 *  closer in shape to a folder than to a single chat turn, so they read
 *  better as tiles than as ConversasView's dense rows. */
const ProjectCard: React.FC<{ project: Project; onDelete: () => void }> = ({ project, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) { onDelete(); return; }
    setConfirmDelete(true);
    setTimeout(() => setConfirmDelete(false), 2500);
  };

  return (
    <div className="group relative text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors">
      <button
        onClick={handleDelete}
        className={`absolute top-4 right-4 p-1 rounded transition-[opacity,color] duration-150 ${
          confirmDelete ? 'opacity-100 text-red-400' : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400'
        }`}
        title={confirmDelete ? t('common.confirmDelete') : t('projects.delete')}
      >
        <Trash2 size={13} />
      </button>
      <h3 className="text-[15px] font-semibold text-white/90 pr-6 truncate">{project.name}</h3>
      <p className="text-[13px] text-white/45 mt-1.5 leading-relaxed line-clamp-2 min-h-[2.6em]">
        {project.description || t('projects.noDescription')}
      </p>
      <p className="text-[11.5px] text-white/25 mt-4">
        {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : t('conversas.time.now')}
      </p>
    </div>
  );
};

const NewProjectCard: React.FC<{ onCreate: (name: string, description: string) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="p-5 rounded-2xl border border-[#d97757]/40 bg-[#d97757]/[0.04]">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('projects.namePlaceholder')}
        className="w-full bg-transparent border-none outline-none text-[15px] font-semibold text-white placeholder:text-white/30"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t('projects.descriptionPlaceholder')}
        rows={2}
        className="w-full bg-transparent border-none outline-none resize-none text-[13px] text-white/70 placeholder:text-white/25 mt-1.5 leading-relaxed"
      />
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => name.trim() && onCreate(name, description)}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-[#d97757] text-[#2a1a12] hover:bg-[#e08865] disabled:opacity-40 transition-colors"
        >
          {t('projects.create')}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white/50 hover:text-white/80 transition-colors">
          {t('projects.cancel')}
        </button>
      </div>
    </div>
  );
};

interface ProjectsViewProps {
  isGuest: boolean;
  projectList: Project[];
  onCreateProject: (name: string, description: string) => void;
  onDeleteProject: (id: string) => void;
  onSignIn: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ isGuest, projectList, onCreateProject, onDeleteProject, onSignIn }) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectList
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : (b.updatedAt ?? Infinity) - (a.updatedAt ?? Infinity));
  }, [projectList, query, sort]);

  const handleCreate = (name: string, description: string) => {
    onCreateProject(name, description);
    setCreating(false);
  };

  return (
    <div className="flex-1 overflow-y-auto VUXIO-scroll px-6 sm:px-10 pt-16 pb-10 animate-fade-up">
      <div className="max-w-[880px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[26px] text-white/95" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{t('projects.title')}</h1>
          {!isGuest && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setSortOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {t('projects.sortBy')} <span className="text-white/85 font-medium">{sort === 'updated' ? t('projects.sortUpdated') : t('projects.sortName')}</span>
                  <ChevronDown size={13} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 mt-1 w-40 rounded-lg border border-white/10 bg-[#2b2926] py-1 shadow-xl z-10 animate-menu-pop-down">
                    {(['updated', 'name'] as const).map(value => (
                      <button
                        key={value}
                        onClick={() => { setSort(value); setSortOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12.5px] text-white/75 hover:bg-white/[0.06] transition-colors"
                      >
                        {value === 'updated' ? t('projects.sortUpdated') : t('projects.sortName')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setCreating(true)}
                className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-white text-[#1a1917] hover:bg-white/85 transition-[background-color,transform] hover:-translate-y-px active:translate-y-0"
                style={{ transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--ease-out)' }}
              >
                {t('projects.new')}
              </button>
            </div>
          )}
        </div>

        {isGuest ? (
          <div className="rounded-2xl border border-white/10 p-10 text-center">
            <p className="text-sm text-white/40 mb-4">{t('projects.needAccount')}</p>
            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded-lg text-[13px] font-medium bg-white text-[#1a1917] hover:bg-white/85 transition-colors"
            >
              {t('sidebar.login')}
            </button>
          </div>
        ) : (
          <>
            {projectList.length > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03]">
                  <Search size={15} className="text-white/35 shrink-0" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('projects.search')}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-white/85 placeholder:text-white/30"
                  />
                </div>
              </div>
            )}

            {visible.length === 0 && !creating ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
                <p className="text-sm text-white/40 mb-4">
                  {projectList.length === 0 ? t('projects.empty') : t('projects.noMatch')}
                </p>
                {projectList.length === 0 && (
                  <button
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-white text-[#1a1917] hover:bg-white/85 transition-colors"
                  >
                    <Plus size={14} /> {t('projects.new')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {creating && <NewProjectCard onCreate={handleCreate} onCancel={() => setCreating(false)} />}
                {visible.map(project => (
                  <ProjectCard key={project.id} project={project} onDelete={() => onDeleteProject(project.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
