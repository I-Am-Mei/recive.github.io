const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// Generate random password
function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Load dashboard
async function loadDashboard() {
  const { data: users } = await client.from('user').select('*');
  const { data: tasks } = await client.from('tasks').select('*');
  const { data: timeOff } = await client.from('time_off_requests').select('*');

  const dashboard = document.getElementById('dashboard-content');

  // Show Head or Lead options
  if (user.role === 'Head' || user.role === 'Lead') {
    // Show create user section only for Head
    if (user.role === 'Head') {
      document.getElementById('create-user-section').classList.remove('hidden');
    }

    // Filter users for Lead to only their team
    const visibleUsers = user.role === 'Lead'
      ? users.filter(u => u.team_id === user.team_id) // Assuming each user has a team_id
      : users;

    // Group users by role/level
    const grouped = {};
    visibleUsers.forEach(u => {
      if (!grouped[u.level]) grouped[u.level] = [];
      grouped[u.level].push(u);
    });

    for (const level in grouped) {
      const section = document.createElement('div');
      section.classList.add('mb-6');
      section.innerHTML = `<h2 class='text-xl font-semibold mb-2'>${level}</h2>`;
      const list = document.createElement('ul');
      grouped[level].forEach(u => {
        const li = document.createElement('li');
        li.classList.add('mb-1');
        li.innerHTML = `${u.username} - Password: ${u.password} <button class='bg-blue-500 text-white px-2 py-1 rounded ml-2 assign-btn' data-user='${u.id}'>Assign Task</button>`;
        list.appendChild(li);
      });
      section.appendChild(list);
      dashboard.appendChild(section);
    }

    // Show pending time-off requests only for Head
    if (user.role === 'Head') {
      const pendingRequests = timeOff.filter(r => r.status === 'Pending');
      const timeOffSection = document.createElement('div');
      timeOffSection.classList.add('mb-6');
      timeOffSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>Pending Time Off Requests</h2>`;
      const rList = document.createElement('ul');
      pendingRequests.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `${r.user_id} - ${r.start_date} to ${r.end_date} 
          <button class='approve-btn' data-id='${r.id}'>Approve</button>
          <button class='deny-btn' data-id='${r.id}'>Deny</button>`;
        rList.appendChild(li);
      });
      timeOffSection.appendChild(rList);
      dashboard.appendChild(timeOffSection);
    }
  } else {
    // Regular users: show only their tasks and time off
    const myTasks = tasks.filter(t => t.assigned_to === user.id);
    const myTimeOff = timeOff.filter(r => r.user_id === user.id);

    const tasksSection = document.createElement('div');
    tasksSection.classList.add('mb-4');
    tasksSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Tasks</h2>`;
    const tList = document.createElement('ul');
    myTasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.title} - ${t.status}`;
      tList.appendChild(li);
    });
    tasksSection.appendChild(tList);

    const timeSection = document.createElement('div');
    timeSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Time Off Requests</h2>`;
    const rList = document.createElement('ul');
    myTimeOff.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.start_date} to ${r.end_date} - ${r.status}`;
      rList.appendChild(li);
    });
    timeSection.appendChild(rList);

    dashboard.appendChild(tasksSection);
    dashboard.appendChild(timeSection);
  }
}

// Event listeners for approving/denying time off
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('approve-btn') || e.target.classList.contains('deny-btn')) {
    const id = e.target.dataset.id;
    const newStatus = e.target.classList.contains('approve-btn') ? 'Approved' : 'Denied';
    await client.from('time_off_requests').update({ status: newStatus }).eq('id', id);
    loadDashboard();
  }

  // Assign task button
  if (e.target.classList.contains('assign-btn')) {
    const userId = e.target.dataset.user;
    const taskTitle = prompt("Enter task title:");
    if (taskTitle) {
      await client.from('tasks').insert([{ title: taskTitle, assigned_to: userId, status: 'Pending' }]);
      loadDashboard();
    }
  }
});

loadDashboard();

// Create new user
document.getElementById('create-user-btn').addEventListener('click', async () => {
  const newUsername = document.getElementById('new-username').value.trim();
  const newRole = document.getElementById('new-role').value;
  const newPassword = generatePassword();

  const validRoles = ['Head', 'Junior', 'Senior', 'Lead', 'Artist', 'Animator', 'Musician', 'Writer', 'VA'];
  if (!newUsername) {
    showError("Username is required!");
    return;
  }
  if (!validRoles.includes(newRole)) {
    showError("Invalid role selected!");
    return;
  }

  try {
    const { data, error } = await client.from('user').insert([
      { username: newUsername, password: newPassword, role: newRole }
    ]);
    if (error) throw error;

    showSuccess(`User "${newUsername}" created! Password: ${newPassword}`);
    document.getElementById('new-username').value = "";
  } catch (err) {
    showError("Error creating user: " + err.message);
  }
});

// Helper functions
function showError(msg) {
  const errorEl = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
  successEl.classList.add('hidden');
}
function showSuccess(msg) {
  const errorEl = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
  successEl.textContent = msg;
  successEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
}

// Logout
document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('session');
  window.location.href = 'index.html';
});
