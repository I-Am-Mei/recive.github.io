// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg";

// Guard: make it obvious if the SDK is missing
if (typeof window.supabase === "undefined") {
  console.error(
    "[Dashboard] Supabase SDK not found. Include it in your HTML, e.g.: " +
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>'
  );
}
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user; // your app stores your own `user` here

// --- Helpers (UI messages) ---
function setFlash(id, msg, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'red' : 'green';
  setTimeout(() => { el.textContent = ""; }, 3000);
}
const showTaskMsg   = (m, e=false) => setFlash('task-msg', m, e);
const showCreateMsg = (m, e=false) => setFlash('create-msg', m, e);
const showTimeOffMsg= (m, e=false) => setFlash('timeoff-msg', m, e);

// --- Role-based section visibility ---
document.addEventListener('DOMContentLoaded', function() {
  const createTaskSection = document.getElementById('create-task-section');
  const createUserSection = document.getElementById('create-user-section');
  const timeoffSection    = document.getElementById('timeoff-section');

  if (user.role !== "Head") {
    createTaskSection?.classList.add("hidden");
    createUserSection?.classList.add("hidden");
  } else {
    createTaskSection?.classList.remove("hidden");
    createUserSection?.classList.remove("hidden");
  }

  // time off visible for everyone
  timeoffSection?.classList.remove("hidden");

  // initial loads
  loadTasks();
  loadMyTasks();
  loadTimeOff();
});

// ============ TASKS ============

// Create Task (Heads only)
document.getElementById('create-task-btn')?.addEventListener('click', async () => {
  if (user.role !== "Head") return;

  const title = document.getElementById('task-title')?.value.trim();
  const desc  = document.getElementById('task-desc')?.value.trim();
  const role  = document.getElementById('task-role')?.value;

  if (!title || !desc || !role) return showTaskMsg("Title, description & role required!", true);

  try {
    const { error } = await client.from('tasks').insert([{
      title,
      description: desc,
      status: 'unassigned',
      assigned_to: null,
      role,
      created_at: new Date()
    }]);

    if (error) throw error;
    showTaskMsg("Task created successfully!");
    // clear
    if (document.getElementById('task-title')) document.getElementById('task-title').value = "";
    if (document.getElementById('task-desc'))  document.getElementById('task-desc').value  = "";
    if (document.getElementById('task-role'))  document.getElementById('task-role').value  = "";
    loadTasks();
  } catch (err) {
    console.error('[Create Task] ', err);
    showTaskMsg("Error: " + err.message, true);
  }
});

// Load list of available tasks (by role)
async function loadTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  list.innerHTML = "Loading...";

  const { data, error } = await client.from('tasks').select('*');
  if (error) {
    console.error('[Load Tasks] ', error);
    list.innerHTML = "Error loading tasks.";
    return;
  }

  // Show: Heads see all unassigned, Leads & Workers see unassigned tasks for THEIR role (so they can accept)
  let filtered;
  if (user.role === "Head") {
    filtered = (data || []).filter(t => !t.assigned_to);
  } else {
    filtered = (data || []).filter(t => t.role === user.role && !t.assigned_to);
  }

  if (!filtered.length) {
    list.innerHTML = "No available tasks.";
    return;
  }

  list.innerHTML = "";
  filtered.forEach(task => {
    const li = document.createElement('li');
    li.textContent = `${task.title} — ${task.description}`;

    // Accept button for matching role (Head can also accept if they want)
    const canAccept = user.role === "Head" || task.role === user.role;
    if (canAccept && task.status === 'unassigned') {
      const btn = document.createElement('button');
      btn.textContent = "Accept";
      btn.className = "ml-2 px-2 py-1 rounded bg-green-500 text-white";
      btn.onclick = () => acceptTask(task.id);
      li.appendChild(btn);
    }

    list.appendChild(li);
  });
}

// Load my accepted tasks
async function loadMyTasks() {
  const list = document.getElementById('my-task-list');
  if (!list) return;
  list.innerHTML = "Loading...";

  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('assigned_to', user.id);

  if (error) {
    console.error('[Load My Tasks] ', error);
    list.innerHTML = "Error loading tasks.";
    return;
  }

  if (!data.length) {
    list.innerHTML = "No accepted tasks.";
    return;
  }

  list.innerHTML = "";
  data.forEach(task => {
    const li = document.createElement('li');
    li.textContent = `${task.title} — ${task.description}`;
    list.appendChild(li);
  });
}

// Accept a task
async function acceptTask(taskId) {
  try {
    const { error } = await client
      .from('tasks')
      .update({ status: 'assigned', assigned_to: user.id })
      .eq('id', taskId);

    if (error) throw error;
    // Refresh both lists so it disappears from Available and appears in My Tasks
    loadTasks();
    loadMyTasks();
  } catch (err) {
    console.error('[Accept Task] ', err);
    alert("Error accepting task: " + err.message);
  }
}

// ============ TIME OFF ============

// List time off requests (Heads see Approve/Deny)
async function loadTimeOff() {
  const list = document.getElementById('timeoff-list');
  if (!list) return;
  list.innerHTML = "Loading...";

  // Use your real table: time_off_requests
  // Try to join the user table to get username; if join fails, we’ll still render with user_id
  const { data, error } = await client
    .from('time_off_requests')
    .select(`
      id, user_id, start_date, end_date, reason, status, requested_at,
      user:user_id (username)
    `)
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('[Load Time Off] ', error);
    list.innerHTML = "Error loading time off requests.";
    return;
  }

  list.innerHTML = "";
  (data || []).forEach(req => {
    const li = document.createElement('li');
    const who = req.user?.username || `User ${req.user_id}`;
    li.innerHTML = `${who} — ${req.start_date} to ${req.end_date} — ${req.reason} (<strong>${req.status}</strong>)`;

    if (user.role === "Head" && req.status === 'pending') {
      const approveBtn = document.createElement('button');
      approveBtn.textContent = "Approve";
      approveBtn.className = "ml-2 px-2 py-1 rounded bg-green-500 text-white";
      approveBtn.onclick = () => updateTimeOff(req.id, 'approved');

      const denyBtn = document.createElement('button');
      denyBtn.textContent = "Deny";
      denyBtn.className = "ml-2 px-2 py-1 rounded bg-red-500 text-white";
      // use 'rejected' to match your original schema
      denyBtn.onclick = () => updateTimeOff(req.id, 'rejected');

      li.appendChild(approveBtn);
      li.appendChild(denyBtn);
    }

    list.appendChild(li);
  });
}

// Approve / Reject a time off request
async function updateTimeOff(id, status) {
  try {
    const { error } = await client
      .from('time_off_requests')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    loadTimeOff();
  } catch (err) {
    console.error('[Update Time Off] ', err);
    alert("Error updating time off: " + err.message);
  }
}

// ============ USER CREATION (Heads only) ============
document.getElementById('create-user-btn')?.addEventListener('click', async () => {
  if (user.role !== "Head") return;

  const username = document.getElementById('new-username')?.value.trim();
  const password = document.getElementById('new-password')?.value.trim() || 'password123';
  const role     = document.getElementById('new-role')?.value;
  const level    = document.getElementById('new-level')?.value || 'Junior';

  if (!username || !role) return showCreateMsg("Username & role required!", true);

  try {
    const { error } = await client.from('user').insert([{
      username, password, role, level
    }]);

    if (error) throw error;
    showCreateMsg("User created!");

    if (document.getElementById('new-username')) document.getElementById('new-username').value = "";
    if (document.getElementById('new-password')) document.getElementById('new-password').value = "";
    if (document.getElementById('new-role'))     document.getElementById('new-role').value = "";
    if (document.getElementById('new-level'))    document.getElementById('new-level').value = "Junior";
  } catch (err) {
    console.error('[Create User] ', err);
    showCreateMsg("Error: " + err.message, true);
  }
});

// --- Logout ---
document.getElementById('logout')?.addEventListener('click', () => {
  localStorage.removeItem('session');
  window.location.href = 'index.html';
});
