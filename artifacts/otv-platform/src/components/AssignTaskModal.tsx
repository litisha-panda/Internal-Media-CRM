import React from "react";
import { C, USER_ROLES, TASK_PRIORITIES, TODAY } from "../constants";
import type { TaskForm, UserRole } from "../types";

interface AssignTaskModalProps {
  taskModal: boolean;
  selfTaskMode: boolean;
  taskForm: TaskForm;
  setTaskForm: React.Dispatch<React.SetStateAction<TaskForm>>;
  isRep: boolean;
  user_role: UserRole | null;
  activeUser: string;
  user: { name?: string } | null;
  BLANK_TASK_FORM: TaskForm;
  setTaskModal: (v: boolean) => void;
  setSelfTaskMode: (v: boolean) => void;
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  showToast: (msg: string, type?: string) => void;
}

export function AssignTaskModal({
  taskModal, selfTaskMode, taskForm, setTaskForm,
  isRep, user_role, activeUser, user, BLANK_TASK_FORM,
  setTaskModal, setSelfTaskMode, setTasks, showToast,
}: AssignTaskModalProps) {
  if (!taskModal) return null;

  const closeTaskModal = () => {
    setTaskModal(false);
    setSelfTaskMode(false);
    setTaskForm(BLANK_TASK_FORM);
  };
  const modalTitle = selfTaskMode ? "Create Task for Myself" : isRep ? "Create Task" : "Assign Task";
  const repDefaultUserId = (isRep && !selfTaskMode && !taskForm.assignedToUserId) ? (user_role?.id || "") : "";

  return (
    <div className="overlay" onClick={closeTaskModal}>
      <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
        <div className="sans" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{modalTitle}</div>
        {selfTaskMode && <div style={{ fontSize: 11, color: C.dim, marginBottom: 14 }}>This task will appear in your My Tasks</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {selfTaskMode ? (
            <div>
              <label>Assigned To</label>
              <input readOnly value={(user_role?.name || "Me") + " (You)"} style={{ color: C.text, background: C.s2, cursor: "default" }} />
            </div>
          ) : (
            <div>
              <label>{isRep ? "Assign to (default: yourself)" : "Assign to *"}</label>
              <select value={taskForm.assignedToUserId || repDefaultUserId} onChange={e => setTaskForm(p => ({ ...p, assignedToUserId: e.target.value }))}>
                <option value="">— Select person —</option>
                <optgroup label="Leadership &amp; Strategy">
                  {USER_ROLES.filter(u => ["ADMIN", "SALES HEAD", "SALES STRATEGY", "CRO", "DIGI OPS"].includes(u.role)).map(u => (
                    <option key={u.id} value={u.id}>{u.id === activeUser ? "Me — " + u.name : u.name} · {u.role}</option>
                  ))}
                </optgroup>
                <optgroup label="Region Heads">
                  {USER_ROLES.filter(u => u.role === "REGION HEAD").map(u => (
                    <option key={u.id} value={u.id}>{u.id === activeUser ? "Me — " + u.name : u.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Sales Reps">
                  {USER_ROLES.filter(u => u.role === "SALES REP").map(u => (
                    <option key={u.id} value={u.id}>{u.id === activeUser ? "Me — " + u.name : u.name} · {u.region}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
          <div><label>Task *</label><input placeholder="What needs to happen?" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><label>Related Client (optional)</label><input placeholder="Which client is this about?" value={taskForm.clientCompany} onChange={e => setTaskForm(p => ({ ...p, clientCompany: e.target.value }))} /></div>
          <div><label>Details</label><textarea rows={3} placeholder="Add context or instructions..." value={(taskForm as any).description || ""} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value } as any))} style={{ resize: "none" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label>Priority</label>
              <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
                {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label>Due Date</label><input type="date" min="2020-01-01" max="2099-12-31" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={closeTaskModal}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const assignedUserId = taskForm.assignedToUserId || (isRep && user_role?.id ? user_role.id : "");
            if (!assignedUserId || !taskForm.title) { showToast("Task title and assignee required", "err"); return; }
            const assignedUser = USER_ROLES.find(u => u.id === assignedUserId);
            const repId = (assignedUser as any)?.repId || null;
            const taskDept = assignedUser?.role === "DIGI OPS" ? "Digital"
              : assignedUser?.role === "SALES HEAD" ? "NSH"
              : assignedUser?.role === "SALES STRATEGY" ? "Sales Strategy"
              : assignedUser?.role === "CRO" ? "CRO"
              : assignedUser?.role === "REGION HEAD" ? "Region Head"
              : null;
            setTasks((p: any[]) => [{
              id: `t${Date.now()}`, ...taskForm, dept: taskDept,
              assignedToUserId: assignedUserId,
              assignedToName: assignedUser?.name || "",
              assignedTo: repId, repId, assignedBy: activeUser,
              assignedByName: user_role?.name || user?.name || "",
              status: "Open", createdAt: TODAY,
            }, ...p]);
            closeTaskModal();
            showToast(assignedUserId === activeUser ? "✓ Task created for yourself" : "Task assigned to " + (assignedUser?.name || ""));
          }}>{selfTaskMode ? "Create Task" : isRep ? "Create Task" : "Assign Task"}</button>
        </div>
      </div>
    </div>
  );
}
