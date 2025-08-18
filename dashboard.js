// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// --- Generate random password ---
function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// --- Task Creation ---
document.getElementById('create-task-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('task-title').value;
  const desc = document.getElementById('task-desc').value;
  const role = document.getElementById('task-role').value;

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ 
      title: title,
      description: desc,
      status: 'unassigned',
      assigned_to: null,
      role: role,
      created_at: new Date()
    }]);

  const msg = document.getElementById('task-msg');
  if (error) {
    msg.textContent = error.message;
    msg.classList.remove('hidden', 'text-green-500');
    msg.classList.add('text-red-500');
  } else {
    msg.textContent = 'Task created!';
    msg.classList.remove('hidden', 'text-red-500');
    msg.classList.add('text-green-500');
    loadTasks();
  }
});

// --- Load Tasks ---
async function loadTasks() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  const container = document.getElementById('tasks-container');
  container.innerHTML = '';

  if (tasks) {
    tasks.forEach(task => {
      const assigned = task.assigned_to ? `Assigned to ${task.assigned_to}` : 'Unassigned';
      const btn = task.assigned_to ? '' : `<button onclick="claimTask(${task.id})" class="bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs ml-2">Claim Task</button>`;
      container.innerHTML += `
        <div class="border p-2 mb-2 rounded">
          <strong>${task.title}</strong> (${task.role})<br>
          ${task.description}<br>
          <span class="text-sm">${assigned}</span>
          ${btn}
        </div>
      `;
    });
  }
}

// --- Claim Task ---
async function claimTask(taskId) {
  const userId = user.id;
  const { data, error } = await supabase
    .from('tasks')
    .update({ assigned_to: userId, status: 'assigned' })
    .eq('id', taskId);

  if (!error) loadTasks();
}

// --- Dashboard ---
async function loadDashboard() {
  const { data: users } = await supabase.from('user').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: timeOff } = await supabase.from('time_off_requests').select('*');

  const dashboard = document.getElementById('dashboard-content');
  dashboard.innerHTML = "";

  if (['Head', 'Lead'].includes(user.role)) {
    if (user.role === 'Head') document.getElementById('create-user-section').classList.remove('hidden');

    const visibleUsers = user.role === 'Lead' ? users.filter(u => u.team_id === user.team_id) : users;
    const groupedByRole = {};
    visibleUsers.forEach(u => { 
      if (!groupedByRole[u.role]) groupedByRole[u.role] = [];
      groupedByRole[u.role].push(u);
    });

    for (const role in groupedByRole) {
      const section = document.createElement('div');
      section.classList.add('mb-4');
      section.innerHTML = `
        <button class="role-toggle w-full text-left bg-gray-200 px-2 py-1 rounded">${role}</button>
        <ul class="role-users hidden list-disc pl-6 mt-2"></ul>
      `;
      const list = section.querySelector('.role-users');

      const sortedUsers = groupedByRole[role].sort((a, b) => {
        const order = ['Head', 'Lead', 'Senior', 'Junior'];
        return order.indexOf(a.level) - order.indexOf(b.level);
      });

      sortedUsers.forEach(u => {
        const li = document.createElement('li');
        li.innerHTML = `${u.username} - Password: ${u.password} 
          ${['Head', 'Lead'].includes(user.role) ? `<button class='assign-btn bg-blue-500 text-white px-2 py-1 rounded ml-2' data-user='${u.id}'>Assign Task</button>` : ''}`;
        list.appendChild(li);
      });

      dashboard.appendChild(section);
    }

    document.querySelectorAll('.role-toggle').forEach(btn => {
      btn.addEventListener('click', () => btn.nextElementSibling.classList.toggle('hidden'));
    });

    if (user.role === 'Head') {
      const pendingRequests = timeOff.filter(r => r.status === 'Pending');
      if (pendingRequests.length) {
        const timeOffSection = document.createElement('div');
        timeOffSection.classList.add('mb-6');
        timeOffSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>Pending Time Off Requests</h2>`;
        const rList = document.createElement('ul');

        pendingRequests.forEach(r => {
          const requestUser = users.find(u => u.id === r.user_id);
          const li = document.createElement('li');
          li.innerHTML = `${requestUser?.username || r.user_id} - ${r.start_date} to ${r.end_date} 
            <button class='approve-btn bg-green-500 text-white px-2 py-1 rounded ml-1' data-id='${r.id}'>Approve</button>
            <button class='deny-btn bg-red-500 text-white px-2 py-1 rounded ml-1' data-id='${r.id}'>Deny</button>`;
          rList.appendChild(li);
        });

        timeOffSection.appendChild(rList);
        dashboard.appendChild(timeOffSection);
      }
    }

  } else {
    const myTasks = tasks.filter(t => t.assigned_to === user.id);
    const myTimeOff = timeOff.filter(r => r.user_id === user.id);

    const tasksSection = document.createElement('div');
    tasksSection.classList.add('mb-4');
    tasksSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Tasks</h2>`;
    const tList = document.createElement('ul');
    myTasks.forEach(t => { const li = document.createElement('li'); li.textContent = `${t.title} - ${t.status}`; tList.appendChild(li); });
    tasksSection.appendChild(tList);

    const timeSection = document.createElement('div');
    timeSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Time Off Requests</h2>`;
    const rList = document.createElement('ul');
    myTimeOff.forEach(r => { const li = document.createElement('li'); li.textContent = `${r.start_date} to ${r.end_date} - ${r.status}`; rList.appendChild(li); });
    timeSection.appendChild(rList);

    dashboard.appendChild(tasksSection);
    dashboard.appendChild(timeSection);
  }
}

// --- Event Listeners for Approve/Deny ---
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('approve-btn') || e.target.classList.contains('deny-btn')) {
    const id = e.target.dataset.id;
    const newStatus = e.target.classList.contains('approve-btn') ? 'Approved' : 'Denied';
    await supabase.from('time_off_requests').update({ status: newStatus }).eq('id', id);
    loadDashboard();
  }
});

// --- Initial load ---
loadTasks();
loadDashboard();
