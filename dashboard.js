// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg"; // replace with your key
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// --- Generate random password ---
function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
    loadTasks();
  }
});

function showTaskMsg(msg, isError) {
  const el = document.getElementById('task-msg');
  el.textContent = msg;
  el.classList.remove('hidden', 'text-green-500', 'text-red-500');
  el.classList.add(isError ? 'text-red-500' : 'text-green-500');
}

// --- Load Tasks ---
async function loadTasks() {
  const { data: tasks, error } = await client
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  const container = document.getElementById('tasks-container');
  container.innerHTML = '';

  if (error) {
    container.innerHTML = `<p class="text-red-500">${error.message}</p>`;
    return;
  }

  if (tasks && tasks.length) {
    tasks.forEach(task => {
      const assigned = task.assigned_to ? `Assigned to ${task.assigned_to}` : 'Unassigned';
      const btn = task.assigned_to
        ? ''
        : `<button onclick="claimTask(${task.id})" 
             class="bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs ml-2">
             Claim Task</button>`;
      container.innerHTML += `
        <div class="border p-2 mb-2 rounded">
          <strong>${task.title}</strong> (${task.role})<br>
          ${task.description}<br>
          <span class="text-sm">${assigned}</span>
          ${btn}
        </div>
      `;
    });
  } else {
    container.innerHTML = "<p>No tasks yet.</p>";
  }
}

// --- Claim Task ---
async function claimTask(taskId) {
  const userId = user.id;
  const { error } = await client
    .from('tasks')
    .update({ assigned_to: userId, status: 'assigned' })
    .eq('id', taskId);

  if (!error) loadTasks();
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
loadTasks();

