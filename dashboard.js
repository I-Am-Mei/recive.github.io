// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// --- Create Task ---
document.getElementById('create-task-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const role = document.getElementById('task-role').value;

  if (!title || !desc) return showTaskMsg("Title & description required!", true);

  const { error } = await client.from('tasks').insert([{
    title,
    description: desc,
    status: 'unassigned',
    assigned_to: null,
    role,
    created_at: new Date()
  }]);

  if (error) {
    showTaskMsg("Error: " + error.message, true);
  } else {
    showTaskMsg("Task created!", false);
    document.getElementById('task-title').value = "";
    document.getElementById('task-desc').value = "";
    loadDashboard();
  }
});

function showTaskMsg(msg, isError) {
  const el = document.getElementById('task-msg');
  el.textContent = msg;
  el.classList.remove('hidden', 'text-green-500', 'text-red-500');
  el.classList.add(isError ? 'text-red-500' : 'text-green-500');
}

// --- Load Dashboard ---
async function loadDashboard() {
  const { data: users, error: userErr } = await client.from('user').select('*');
  const { data: tasks, error: taskErr } = await client.from('tasks').select('*');

  const dashboard = document.getElementById('dashboard-content');
  dashboard.innerHTML = "";

  if (userErr || taskErr) {
    dashboard.innerHTML = `<p class="text-red-500">Error loading data</p>`;
    return;
  }

  let visibleUsers = [];
  let visibleTasks = [];

  if (user.role === "Head") {
    // Head: see all people and all tasks
    visibleUsers = users;
    visibleTasks = tasks;
  } else if (user.level === "Lead") {
    // Leads: only see people in same role/department
    visibleUsers = users.filter(u => u.role === user.role);
    // Tasks limited to their role/department
    visibleTasks = tasks.filter(t => t.role === user.role);
  } else {
    // Regulars: only themselves and their own tasks
    visibleUsers = users.filter(u => u.id === user.id);
    visibleTasks = tasks.filter(t => t.assigned_to === user.id);
  }

  // --- People Section ---
  const peopleSection = document.createElement('div');
  peopleSection.classList.add('mb-6');
  peopleSection.innerHTML = `<h2 class="text-xl font-semibold mb-2">People</h2>`;
  const uList = document.createElement('ul');
  visibleUsers.forEach(u => {
    const li = document.createElement('li');
    li.textContent = `${u.username} (${u.level} ${u.role})`;
    uList.appendChild(li);
  });
  peopleSection.appendChild(uList);
  dashboard.appendChild(peopleSection);

  // --- Tasks Section ---
  const tasksSection = document.createElement('div');
  tasksSection.classList.add('mb-6');
  tasksSection.innerHTML = `<h2 class="text-xl font-semibold mb-2">Tasks</h2>`;
  const tList = document.createElement('ul');

  if (visibleTasks.length === 0) {
    const li = document.createElement('li');
    li.textContent = "No tasks found.";
    tList.appendChild(li);
  } else {
    visibleTasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.title} - ${t.status}`;
      // Allow claiming only if unassigned & in scope
      if (!t.assigned_to && (user.role === "Head" || (user.level === "Lead" && t.role === user.role))) {
        const btn = document.createElement('button');
        btn.textContent = "Claim Task";
        btn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded ml-2 text-xs";
        btn.onclick = () => claimTask(t.id);
        li.appendChild(btn);
      }
      tList.appendChild(li);
    });
  }

  tasksSection.appendChild(tList);
  dashboard.appendChild(tasksSection);
}

// --- Claim Task ---
async function claimTask(taskId) {
  const { error } = await client
    .from('tasks')
    .update({ assigned_to: user.id, status: 'assigned' })
    .eq('id', taskId);

  if (!error) loadDashboard();
}

// --- Logout ---
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('session');
    window.location.href = 'index.html';
  });
}

// --- Initial load ---
loadDashboard();
