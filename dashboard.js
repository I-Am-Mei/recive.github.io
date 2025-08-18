// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// --- Hide task creation unless Head ---
const createTaskSection = document.getElementById('create-task-section');
if (user.role !== "Head") {
  createTaskSection.classList.add("hidden");
}

// --- Create Task (Heads only) ---
document.getElementById('create-task-btn')?.addEventListener('click', async () => {
  if (user.role !== "Head") return; // double safety

  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const role = document.getElementById('task-role').value;

  if (!title || !desc) return showTaskMsg("Title & description required!", true);

  const { error } = await client.from('tasks').insert([{
    title,
    description: desc,
    status: 'unassigned',
    assigned_to: null,
    role, // link task to department
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
    visibleUsers = users;
    visibleTasks = tasks;
  } else if (user.level === "Lead") {
    visibleUsers = users.filter(u => u.role === user.role);
    visibleTasks = tasks.filter(t => t.role === user.role);
  } else {
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
      li.textContent = `${t.title} - ${t.status} (${t.role})`;

      // Head can directly claim
      if (!t.assigned_to && user.role === "Head") {
        const btn = document.createElement('button');
        btn.textContent = "Claim Task";
        btn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded ml-2 text-xs";
        btn.onclick = () => claimTask(t.id);
        li.appendChild(btn);
      }

      // Leads can distribute tasks in their department
      if (!t.assigned_to && user.level === "Lead" && t.role === user.role) {
        const juniorsBtn = document.createElement('button');
        juniorsBtn.textContent = "Assign to Juniors";
        juniorsBtn.className = "bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded ml-2 text-xs";
        juniorsBtn.onclick = () => assignTaskToLevel(t.id, "Junior", user.role);

        const seniorsBtn = document.createElement('button');
        seniorsBtn.textContent = "Assign to Seniors";
        seniorsBtn.className = "bg-purple-500 hover:bg-purple-700 text-white py-1 px-2 rounded ml-2 text-xs";
        seniorsBtn.onclick = () => assignTaskToLevel(t.id, "Senior", user.role);

        const myselfBtn = document.createElement('button');
        myselfBtn.textContent = "Take Myself";
        myselfBtn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded ml-2 text-xs";
        myselfBtn.onclick = () => claimTask(t.id);

        li.appendChild(juniorsBtn);
        li.appendChild(seniorsBtn);
        li.appendChild(myselfBtn);
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

// --- Assign Task to Juniors or Seniors ---
async function assignTaskToLevel(taskId, level, role) {
  const { data: users, error } = await client
    .from('user')
    .select('id')
    .eq('role', role)
    .eq('level', level);

  if (error) {
    alert("Error loading users: " + error.message);
    return;
  }

  if (!users || users.length === 0) {
    alert(`No ${level} ${role}s found`);
    return;
  }

  // For now, assign task to the first user found in that level+role
  const targetUser = users[0];

  await client.from('tasks').update({
    assigned_to: targetUser.id,
    status: "assigned"
  }).eq('id', taskId);

  loadDashboard();
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
