"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Project } from "@/lib/types";

interface ProjectSwitcherProps {
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
}

export default function ProjectSwitcher({ projects, activeProjectId, onProjectChange }: ProjectSwitcherProps) {
  if (projects.length <= 1) return null;

  // Derive display label — never show the raw UUID
  const activeLabel = projects.find((p) => p.id === activeProjectId)?.project_name ?? "Select project";

  return (
    <div className="flex items-center gap-2.5 animate-fade-up">
      <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Project</span>
      <Select value={activeProjectId} onValueChange={(v) => v !== null && onProjectChange(v)}>
        <SelectTrigger className="w-auto min-w-44 max-w-xs h-9 bg-card border-border/80 hover:border-indigo-300 transition-colors">
          {/* Bypass SelectValue — Base UI renders the raw value string, not the item label */}
          <span className="flex-1 text-left text-sm font-semibold truncate text-foreground">{activeLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-sm font-medium">
              {p.project_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
